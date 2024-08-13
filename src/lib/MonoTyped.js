export default class Typed {
	constructor(element, config) {
		config.typeSpeed = config.typeSpeed ?? 100;
		this.speed = config.typeSpeed; // use default type speed
		this.nextPause = null;
		this.config = config;

		this.el = typeof element === 'string'
			? document.querySelector(element)
			: element;

		this.nodeCounter = 0;
		this.setDisplay(this.el, config.strings[0]);
		let spans = this.el.querySelectorAll("span");

		this.config.preStringTyped(0, this);
		this.typewrite(spans);
	}

	get strings() {
		return this.config.strings;
	}

	/**
		@param {HTMLElement} element
		@param {string} curString
	 */
	setDisplay(element, curString) {
		let newElement = document.createElement("div");
		newElement.innerHTML = curString;
		let textNodes = getLeafNodes(newElement);
		this.actions = [];
		for (const textNode of textNodes) {
			const [nodes, actions] = this.parseString(textNode.textContent);
			this.actions = this.actions.concat(...actions);

			// overwrite the node with <span> text
			textNode.replaceWith(...nodes);
			//edits.push(() => textNode.replaceWith(...nodes));
		}
		console.log(this.actions);
		element.replaceChildren(...newElement.childNodes);
	}



	parseString(curString) {

		// Separate curString into text and action sections
		//   eg: "{speed:10}hello {pause:1000}{speed:1000}world!"
		//     -> [ '', '{speed:10}', 'hello ', '{pause:1000}', '', '{speed:1000}', 'world!' ]
		// `(?:<pattern>)` is a non-capturing group, see https://devdocs.io/javascript/regular_expressions/non-capturing_group
		const actionPattern = /(\{(?:pause|speed):\d+\})/;
		const sections = curString.split(actionPattern);

		let nodes = [];
		let actions = [];
		let nodeCounter = 0;

		sections.forEach((section, i) => {
			// text section
			if (i % 2 === 0) {
				// iterate over the string, adding <span>s to the element as we go
				for (const char of section) {
					const textNode = document.createTextNode(char);
					let node;
					const isWhite = /\s/.test(char);
					if (isWhite) {
						node = textNode;
					} else {
						nodeCounter++;
						node = document.createElement('span');
						node.append(textNode);
						node.style.visibility = 'hidden';
					}
					nodes.push(node);
				}
				
			// action section
			} else {
				// extract action and parameter
				const match = /\{(?<action>pause|speed):(?<n>\d+)\}/.exec(section);
				actions[nodeCounter] = {
					action: match.groups.action,
					n: match.groups.n,
				};
			}
		});
		// Force length of 'actions' to equal nodeCounter
		actions[nodeCounter-1] = actions[nodeCounter-1];
		return [nodes, actions];
	}

	executeAction(action) {
		if (action.action == "speed") {
			this.speed = action.n; // overwrites speed value permanently
		} else if (action.action == "pause") {
			this.nextPause = action.n // sets a wait time temporarily
		}

	}

	typewrite(characters) {
		if (this.actions[this.nodeCounter]) {
			this.executeAction(this.actions[this.nodeCounter])
		}
		const waitTime = this.nextPause ?? this.speed;
		if (this.nextPause) {
			this.nextPause = null;
		}
		this.timeout = setTimeout(() => {
			characters[this.nodeCounter].style = "";
			this.nodeCounter += 1;
			if (this.nodeCounter < characters.length) {
				this.typewrite(characters);
			} else {
				this.config.onStringTyped(0, this);
			}
		}, waitTime);
	}

	destroy() {
		clearTimeout(this.timeout);
		this.el.replaceChildren();
		this.config.onDestroy(this);
	}
}

function getLeafNodes(node) {
	let leafNodes = [];

	function traverse(currentNode) {
		if (currentNode.childNodes.length === 0) {
			// It's a leaf node (no child nodes)
			leafNodes.push(currentNode);
		} else {
			// Recursively process child nodes
			currentNode.childNodes.forEach(child => traverse(child));
		}
	}

	traverse(node);
	return leafNodes;
}