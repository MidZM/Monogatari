import { Component } from '../../lib/Component';
import { Util } from '@aegis-framework/artemis';

class MonoTypist extends Component {
	static setup () {
		this.engine.configuration(this.tag, { actions: {} });
		this.engine.globals ({
			textObject: null, // This has effectively become worthless...
			finished_typing: false,
			typedConfiguration: {
				strings: [],
				typeSpeed: this.engine.preference ('TextSpeed'),
				loop: false, // TODO: We need to implement this
				showCursor: false, // TODO: We need to implement this
				preStringTyped: () => {
					this.engine.global ('finished_typing', false);
					this.engine.trigger ('didStartTyping');
				},
				onStringTyped: () => {
					this.engine.global ('finished_typing', true);
					this.engine.trigger ('didFinishTyping');
				},
				onDestroy: () => {
					this.engine.global ('finished_typing', true);
				}
			},
			_dialog_pending_revert: false,
		});

		return Promise.resolve();
	}

	/**
		@static
		@function actions — Return the list of all actions from the actions config.
		@returns {object} The list of actions.
	**/
	static actions () {
		return this.engine.configuration(this.tag).actions;
	}

	/**
		@static
		@function action — Get a specific action from the actions config.
		@param {object} action The name of the action.
		@returns {object} The object of the action being searched for.
	**/
	static action (action) {
		return this.engine.configuration(this.tag).actions[action];
	}

	/**
		@static
		@function addAction — Add an action to the actions configuration.
		@param {object} action An object containing the action options.
		@returns {void}
	**/
	static addAction (action) {
		// Check to see if our action has all of the necessary information to be added as a valid action.
		if (typeof action.action === 'string' && typeof action.type === 'string' && typeof action.func === 'function') {
			this.engine.configuration(this.tag, {
				actions: {
					...this.actions(),
					[action.action]: action
				}
			});
		} else {
			return this.engine.debug.error('Attempted to add an action to typing actions, but an invalid action object was provided:\n' + action);
		}
	}

	constructor (...args) {
		super(...args);

		this.state = {
			config: {},
			strings: [],
			nodes: []
		};

		this.props = {
			string: false,
			start: false,
			typeSpeed: false
		};

		this.typeSpeed = 100;
		this.speed = this.typeSpeed;
		this.nextPause = null;
		this.timeout = null;
		this.stringPos = 0;

		// this.el has been be replaced by this.

		this.nodeCounter = 0;
	}

	/**
		@function initiate — Start the typing animation with a fresh configuration.
		@returns {void}
	**/
	initiate () {
		// Set the typed configuration on each initiation.
		this.setState({ config: this.engine.global('typedConfiguration') });
		if (!this.state.strings.length && this.props.string) {
			this.setState({ strings: [this.props.string] });
		}

		const { config, strings } = this.state;

		// TODO: Multi-String Capability?
		this.setProps({ string: strings[0] });

		// We need to make sure these get reset on every new initiation.
		// Props type speed should always supersede config type speed. Since that means you, as the developer, intentionally set the typeSpeed on that instance.
		if (this.props.typeSpeed) {
			this.typeSpeed = this.props.typeSpeed;
		} else {
			this.typeSpeed = config.typeSpeed ?? this.typeSpeed;
		}
		this.speed = this.typeSpeed;
		this.nextPause = null;
		this.timeout = null;
		this.stringPos = 0;
		this.nodeCounter = 0;

		this.setDisplay(strings[0]);
		this.elements = this.querySelectorAll('no-letter');

		// We only have one string per instance, so these callbacks are equivalent.
		if (typeof this.state.config.onBegin === 'function') {
			this.state.config.onBegin(this);
		}

		this.state.config.preStringTyped(this.stringPos, this);

		this.typewrite();
	}

	/**
		Get all strings.
		@type {string}
	**/
	get strings () {
		return this.state.strings;
	}

	/**
		@static
		@function checkVoidTags — Check for non-enclosing html tags and return properties for.
		@param {*} node The node to check
		@returns {false|object} A boolean false if it's not a void tag, or an object containing properties for the void tag.
	 */
	checkVoidTags (element) {
		// This has been hacked together... it may need to be improved
		const replace = (text, index = 1) => text
			.slice(text.indexOf('-') + index)
			.replace(/[-](\w)/g, m => m[1].toUpperCase());

		const voidElements = [ 'br', 'hr', 'img' ];
		const voidAttributeNames = element.localName && element.getAttributeNames();
		const voidAttributes = voidAttributeNames && voidAttributeNames.map(elm => ({
			[elm]: elm.slice(0, 5) === 'data-' ?
				element.dataset[replace(elm)] :
				elm.slice(0, 5) === 'aria-' ?
					element['aria' + replace(elm, 0)] :
					element[elm === 'class' ? 'className' : elm]
		})).reduce((a, v) => Object.assign(a, v), {});

		const voidProperties = voidElements.map(e => ({
			[e]: {
				props: { [e]: true },
				state: {
					...(voidAttributes)
				}
			}
		})).reduce((a, v) => Object.assign(a, v), {});

		if (element.localName && voidProperties[element.localName.toLowerCase()]) {
			const { props, state = undefined } = voidProperties[element.localName.toLowerCase()];
			const node = document.createElement('no-letter');
			node.style.visibility = 'hidden';

			return { props, state, node };
		}

		return false;
	}

	/**
		@function setDisplay — Setup the current string with the proper elements to run the typing animation.
		@param {string} curString The current string.
		@returns {void} 
	 */
	setDisplay (curString) {
		const typingElement = document.createElement('div');
		typingElement.innerHTML = curString;
		const textNodes = this._getLeafNodes(typingElement);
		this.actions = [];

		for (const textNode of textNodes) {
			const isVoidElement = this.checkVoidTags(textNode);
			if (isVoidElement) {
				const { props, state, node } = isVoidElement;
				node.setProps(props);

				if (state) {
					node.setState(state);
				}

				// overwrite original with a <no-letter> element.
				textNode.replaceWith(node);
			} else {
				const [nodes, actions] = this.parseString(textNode.textContent);
				this.actions = this.actions.concat(...actions);

				// overwrite the node with <no-letter> text
				textNode.replaceWith(...nodes);
			}
		}
		this.querySelector('div').replaceChildren(...typingElement.childNodes);
	}

	/**
	    @function stop — Stop the typing animation.
	**/
	stop () {
		clearTimeout(this.timeout);

		if (typeof this.state.config.onStop === 'function') {
			this.state.config.onStop(this.stringPos, this);
		}
	}

	/**
	    @function start — Start the typing animation again.
	**/
	start () {
		if (!this.timeout) {
		    this.typewrite();


			if (typeof this.state.config.onStart === 'function') {
				this.state.config.onStart(this.stringPos, this);
			}
		}
	}

	/**
		@function parseString — Parse through the current string and replace 
		@param {string} curString The current string.
		@returns {array} An array containing the nodes and actions that were parsed and built.
	**/
	parseString (curString) {
		// Explanation Provided by: @ceets-deets
		// Separate curString into text and action sections
		//   eg: "{speed:10}hello {pause:1000}{speed:1000}world!"
		//     -> [ '', '{speed:10}', 'hello ', '{pause:1000}', '', '{speed:1000}', 'world!' ]
		// `(?:<pattern>)` is a non-capturing group, see https://devdocs.io/javascript/regular_expressions/non-capturing_group
		const acts = Object.entries(this.engine.configuration(MonoTypist.tag).actions)
			.map(([ action, value ]) => ({ [value.type]: [action] }))
			.reduce((a, b) => {
				for (const key in b) {
					if (a[key]) {
						a[key] = a[key].concat(b[key]);
					} else {
						a[key] = b[key];
					}
				}
				return a;
			}, {});

		const number = acts.number.join('|');
		const enclosed = acts.enclosed ? acts.enclosed.join('|') : '';
		const instance = acts.instances ? acts.instance.join('|') : '';

		const numberPattern = `\\{(?:${number}):\\d+\\}`;
		const enclosedPattern = `\\{(?:${enclosed})\\}[^]*?\\{\\/(?:${enclosed})\\}`;
		const instancePattern = `\\{(?:${instance})\\/\\}`;

		const actionPattern = new RegExp(`(${numberPattern}|${enclosedPattern}|${instancePattern})`, 'g');
		const sections = curString.split(actionPattern);

		const nodes = [];
		const actions = [];
		let nodeCounter = 0;

		sections.forEach((section, i) => {
			// text section
			if (i % 2 === 0) {
				// iterate over the string, adding <no-letter>s to the element as we go
				for (const char of section) {
					const textNode = document.createTextNode(char);
					let node;
					const isWhite = /\s/.test(char);
					if (isWhite) {
						node = textNode;
					} else {
						nodeCounter++;
						node = document.createElement('no-letter');
						node.setProps({ letter: char });
						node.style.visibility = 'hidden';
					}
					nodes.push(node);
				}

		    // action section
		    } else {
				// extract action and parameter
				let match;
				let type;
				if (number) {
					type = 'number';
					match = section.match(new RegExp(`^\\{(?<action>${number}):(?<n>\\d+)\\}$`));
				}
				if (!match && enclosed) {
					type = 'enclosed';
					match = section.match(new RegExp(`^\\{(?<action>${enclosed})\\}(?<text>[^]*?)\\{\\/\\1\\}$`));
				}
				if (!match && instance) {
					type = 'instance';
					match = section.match(new RegExp(`^\\{(?<action>${instance})\\/\\}$`));
				}

				if (match) {
					actions[nodeCounter] = {
						action: match.groups.action,
						...(match.groups.n && {n: match.groups.n}),
						...(match.groups.text !== undefined && {text: match.groups.text}),
						...(type === 'enclosed' && {index: nodeCounter - 1})
					};
				} else {
					this.engine.debug.error('Failed to match action:', section);
				}
		    }
		});

		// Force length of 'actions' to equal nodeCounter
		actions[nodeCounter-1] = actions[nodeCounter-1];
		return [nodes, actions];
	}

	/**
		@function executeAction — Execute the provided action asynchronously, even if it's not asynchronous.
		- TODO: Make asynchronous call stop the typing animation(?)
		@param {object} act The action to be executed.
		@returns {void}
	**/
	executeAction (act) {
		const { actions } = this.engine.configuration(MonoTypist.tag);
		for (const key in actions) {
			if (act.action === key) {
				// Since we already know what action it is, we don't need to send that data to the callback function.
				// So we use destructuring to exclude it from the action.
				const { action, ...variables } = act;
				Util.callAsync(actions[key].func, this, this, variables);
			}
		}
	}

	/**
		@function humanizer — Adjust the received speed and return it.
		@param {number} speed A number representing speed.
		@returns {number} The humanized speed.
	**/
	humanizer (speed) {
		return Math.round((Math.random() * speed) / 2) + speed;
	}

	/**
		@function typewrite — "Write" the letters on screen.
		@returns {void}
	**/
	typewrite () {
		if (this.actions[this.nodeCounter]) {
			this.executeAction(this.actions[this.nodeCounter]);
		}

		const waitTime = this.nextPause ?? this.humanizer(this.speed);

		this.timeout = setTimeout(() => {
			if (this.nextPause) {
				this.nextPause = null;

				if (typeof this.state.config.onTypingResumed === 'function') {
					this.state.config.onTypingResumed(this.stringPos, this);
				}
			}

			this.elements[this.nodeCounter].style = '';
			this.nodeCounter += 1;

			if (this.nodeCounter < this.elements.length) {
				this.typewrite();
			} else {
				this.timeout = null;
				this.state.config.onStringTyped(this.stringPos, this);
			}
		}, waitTime);
	}

	/**
		@function _getLeafNodes — Get the leaf nodes of a provided node.
		@param {HTMLElement} node A node element.
		@returns {array} The array of nodes to be processed.
	**/
	_getLeafNodes (node) {
		const leafNodes = [];

		const traverse = currentNode => {
			const children = currentNode.childNodes;

			if (children.length === 0) {
				// It's a leaf node (no child nodes)
				leafNodes.push(currentNode);
			} else {
				// Recursively process child nodes
				children.forEach(child => traverse(child));
			}
		};

		traverse(node);

		return leafNodes;
	}

	/**
		@function destroy — Stop and destroy the current typing animation.
		@returns {void}
	**/
	destroy () {
		clearTimeout(this.timeout);
		this.timeout = null;

		if (this.elements) {
			this.elements.forEach(e => e.style = '');
		}

		if (typeof this.state.config.onDestroy === 'function') {
			this.state.config.onDestroy(this);
		}
	}

	onStateUpdate (property, oldValue, newValue) {
		super.onStateUpdate(property, oldValue, newValue);

		if (property === 'strings') {
			this.forceRender().then(() => {
				this.destroy();
			}).finally(() => {
				this.initiate();
			});
		}

		return Promise.resolve();
	}

	willMount () {
		// We put these adders into the "willMount" method to make sure the component exists and can be referenced.
		this.engine.component('mono-typist').addAction({action: 'pause', type: 'number', func: function (self, number) {
			const num = Number(number);
			if (typeof self.state.config.onTypingPaused === 'function') {
				self.state.config.onTypingPaused(self.stringPos, self);
			}

			if (num) {
				self.nextPause = num;
			} else {
				this.engine.debug.error('Provided value was not a valid number value:\n' + number);
			}
		}});

		this.engine.component('mono-typist').addAction({action: 'speed', type: 'number', func: function (self, number) {
			const percentage = Number(number);
			if (percentage) {
				const speed = Math.floor((self.speed * 100) / percentage);
				self.speed = speed;
			} else {
				this.engine.debug.error('Provided value was not a valid number value:\n' + number);
			}
		}});

		return Promise.resolve();
	}

	didMount () {
		if (this.props.start) this.initiate();
		return Promise.resolve();
	}

	render () {
		return '<div class="typist-container"></div>';
	}
}

MonoTypist.tag = 'mono-typist';


export default MonoTypist;