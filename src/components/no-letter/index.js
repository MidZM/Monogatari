import { Component } from '../../lib/Component';

class NoLetter extends Component {
	constructor (...args) {
		super(...args);

		this.state = {
			img: {}
		};

		this.props = {
			letter: false,
			br: false,
			hr: false,
			img: false
		};
	}

	render () {
		const { letter, br, hr, img } = this.props;
		if (br || hr || img) {
			let text;
			if (br) {
				text = 'br';
			} else if (hr) {
				text = 'hr';
			} else if (img) {
				const properties = Object.entries(this.state.img)
					.map(([ key, value ]) => `${key}="${value}"`)
					.join(' ');

				text = `img ${properties}`;
			}
			return `<${text}>`;
		}

		return letter;
	}
}

NoLetter.tag = 'no-letter';


export default NoLetter;