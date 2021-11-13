import React from "react";
import "./editor.css";
import Editor from "./Editor";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faSun, faMoon } from "@fortawesome/free-solid-svg-icons";

class VideoEditor extends React.Component {
	constructor(props) {
		super(props);
		this.state = {
			isUpload: true,
			videoUrl: "",
			isDarkMode: false,
			video_file: undefined,
		};
	}

	componentDidMount = () => {
		this.toggleThemes();
	};

	render_uploader = () => {
		return (
			<div className={"wrapper"}>
				<input
					onChange={(e) => this.upload_file(e.target.files)}
					type="file"
					className="hidden"
					id="up_file"
				/>
				<div
					className="file-drop"
					onClick={() => document.getElementById("up_file").click()}
				>
					<div className="file-drop-target">
						Click to upload your video and edit!
					</div>
				</div>
			</div>
		);
	};

	render_editor = () => {
		return (
			// Props:
			// videoUrl --> URL of uploaded video
			<Editor
				videoUrl={this.state.videoUrl}
        video_file={this.state.video_file}
			/>
		);
	};

	toggleThemes = () => {
		if (this.state.isDarkMode) {
			document.body.style.backgroundColor = "#1f242a";
			document.body.style.color = "#fff";
		} else {
			document.body.style.backgroundColor = "#fff";
			document.body.style.color = "#1f242a";
		}
		this.setState({ isDarkMode: !this.state.isDarkMode });
	};

	upload_file = (fileInput) => {
		let fileUrl = window.URL.createObjectURL(fileInput[0]);
		this.setState({
			isUpload: false,
			videoUrl: fileUrl,
			video_file: fileInput,
		});
	};

	render = () => {
		return (
			<div>
				{this.state.isUpload
					? this.render_uploader()
					: this.render_editor()}
				<div className={"theme_toggler"} onClick={this.toggleThemes}>
					{this.state.isDarkMode ? (
						<i className="toggle" aria-hidden="true">
							<FontAwesomeIcon icon={faSun} />
						</i>
					) : (
						<i className="toggle">
							<FontAwesomeIcon icon={faMoon} />
						</i>
					)}
				</div>
			</div>
		);
	};
}

export default VideoEditor;
