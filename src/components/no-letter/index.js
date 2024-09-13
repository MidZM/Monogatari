import { Component } from "../../lib/Component";

class NoLetter extends Component {
    constructor(...args) {
        super(...args);

        this.state = {
            img: {}
        }

        this.props = {
            letter: false,
            br: false,
            hr: false,
            img: false
        }
    }

    render() {
        const { letter, br, hr, img } = this.props;
        if (br || hr || img) return `<${br ? "br" : hr ? "hr" : "img"}${img ? " " + Object.entries(this.state.img).map(([ key, value ]) => `${key}="${value}"`).join(" ") : ""}>`;

        return letter;
    }
}

NoLetter.tag = "no-letter";


export default NoLetter;