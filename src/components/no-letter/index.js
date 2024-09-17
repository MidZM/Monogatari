import { Component } from '../../lib/Component';

class NoLetter extends Component {
	constructor (...args) {
		super (...args);

		this.props = {
			letter: false
		};
	}

	render () {
		const { letter } = this.props;
		const props = Object.keys (this._props).map (e => (e !== 'letter' ? e : false));

		if (props[1]) {
			let text = props[1];

			if (Object.values (this._state).length) {
				text += ' ' + Object.entries (this._state)
					.map (([ key, value ]) => value && key === text ? `${key}="${value}"` : '')
					.join (' ');
			}

			return `<${text} />`;
		}

		return letter;
	}
}

NoLetter.tag = 'no-letter';


export default NoLetter;