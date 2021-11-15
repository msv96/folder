import React from "react";
import "./editor.css";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
	faVolumeMute,
	faVolumeUp,
	faPause,
	faPlay,
} from "@fortawesome/free-solid-svg-icons";
import { createFFmpeg, fetchFile } from "@ffmpeg/ffmpeg";
const ffmpeg = createFFmpeg({ log: true });

class Editor extends React.Component {
	constructor(props) {
		super(props);
		this.state = {
			isMuted: false,
			timings: [],
			playing: false,
			currently_grabbed: { index: 0, type: "none" },
			difference: 0.2,
			deletingGrabber: false,
			videoReady: false,
			downloadVideo: [],
		};
		this.playVideo = React.createRef();
		this.progressBar = React.createRef();
		this.playBackBar = React.createRef();
	}

	load = async () => {
		await ffmpeg.load();
	};

	componentDidMount = () => {
		// Check if video ended
		this.load();
		var self = this;
		this.playVideo.current.addEventListener("timeupdate", function () {
			var curr_idx = self.state.currently_grabbed.index;
			var seek =
				((self.playVideo.current.currentTime -
					self.state.timings[curr_idx].start) /
					self.playVideo.current.duration) *
				100;
			self.progressBar.current.style.width = `${seek}%`;
			if (
				self.playVideo.current.currentTime >=
				self.state.timings[self.state.timings.length - 1].end
			) {
				self.playVideo.current.pause();
				self.setState({ playing: false });
			} else if (
				self.playVideo.current.currentTime >=
				self.state.timings[curr_idx].end
			) {
				if (curr_idx + 1 < self.state.timings.length) {
					self.setState(
						{
							currently_grabbed: {
								index: curr_idx + 1,
								type: "start",
							},
						},
						() => {
							self.progressBar.current.style.width = "0%";
							self.progressBar.current.style.left = `${
								(self.state.timings[curr_idx + 1].start /
									self.playVideo.current.duration) *
								100
							}%`;
							self.playVideo.current.currentTime =
								self.state.timings[curr_idx + 1].start;
						}
					);
				}
			}
		});

		window.addEventListener("keyup", function (event) {
			if (event.key === " ") {
				self.play_pause();
			}
		});
		var time = this.state.timings;
		this.playVideo.current.onloadedmetadata = () => {
			time.push({ start: 0, end: this.playVideo.current.duration });
			this.setState({ timings: time }, () => {
				this.addActiveSegments();
			});
		};
	};

	converter = async () => {
		ffmpeg.FS(
			"writeFile",
			"test.mp4",
			await fetchFile(this.props.video_file[0])
		);
		for await (let el of this.state.timings) {
			let d1 = (el.end - el.start).toFixed(1).toString();
			let d2 = el.start.toFixed(1).toString();
			await ffmpeg.run(
				"-i",
				"test.mp4",
				"-t",
				d1,
				"-ss",
				d2,
				"-f",
				"mp4",
				`${d1}.mp4`
			);
			const output_video = ffmpeg.FS("readFile", `${d1}.mp4`);
			const video_url = URL.createObjectURL(
				new Blob([output_video.buffer], { type: "video/mp4" })
			);
			this.setState({
				downloadVideo: [...this.state.downloadVideo, video_url],
			});
		}
		this.setState({ videoReady: true });
	};

	play_pause = () => {
		var self = this;
		if (this.state.playing) {
			this.playVideo.current.pause();
		} else {
			if (
				self.playVideo.current.currentTime >=
				self.state.timings[self.state.timings.length - 1].end
			) {
				self.playVideo.current.pause();
				self.setState(
					{
						playing: false,
						currently_grabbed: { index: 0, type: "start" },
					},
					() => {
						self.playVideo.current.currentTime =
							self.state.timings[0].start;
						self.progressBar.current.style.left = `${
							(self.state.timings[0].start /
								self.playVideo.current.duration) *
							100
						}%`;
						self.progressBar.current.style.width = "0%";
					}
				);
			}
			this.playVideo.current.play();
		}
		this.setState({ playing: !this.state.playing });
	};

	updateProgress = (event) => {
		var playbackRect = this.playBackBar.current.getBoundingClientRect();
		var seekTime =
			((event.clientX - playbackRect.left) / playbackRect.width) *
			this.playVideo.current.duration;
		this.playVideo.current.pause();
		// find where seekTime is in the segment
		var index = -1;
		var counter = 0;
		for (let times of this.state.timings) {
			if (seekTime >= times.start && seekTime <= times.end) {
				index = counter;
			}
			counter += 1;
		}
		if (index === -1) {
			return;
		}
		this.setState(
			{
				playing: false,
				currently_grabbed: { index: index, type: "start" },
			},
			() => {
				this.progressBar.current.style.width = "0%"; // Since the width is set later, this is necessary to hide weird UI
				this.progressBar.current.style.left = `${
					(this.state.timings[index].start /
						this.playVideo.current.duration) *
					100
				}%`;
				this.playVideo.current.currentTime = seekTime;
			}
		);
	};

	startGrabberMove = (event) => {
		this.playVideo.current.pause();
		var playbackRect = this.playBackBar.current.getBoundingClientRect();
		var seekRatio =
			(event.clientX - playbackRect.left) / playbackRect.width;
		const index = this.state.currently_grabbed.index;
		const type = this.state.currently_grabbed.type;
		window.addEventListener("mouseup", () => {
			window.removeEventListener("mousemove", this.startGrabberMove);
			this.addActiveSegments();
		});
		var time = this.state.timings;
		var seek = this.playVideo.current.duration * seekRatio;
		if (
			type === "start" &&
			seek >
				(index !== 0
					? time[index - 1].end + this.state.difference + 0.2
					: 0) &&
			seek < time[index].end - this.state.difference
		) {
			this.progressBar.current.style.left = `${seekRatio * 100}%`;
			this.playVideo.current.currentTime = seek;
			time[index]["start"] = seek;
			this.setState({ timings: time, playing: false });
		} else if (
			type === "end" &&
			seek > time[index].start + this.state.difference &&
			seek <
				(index !== this.state.timings.length - 1
					? time[index + 1].start - this.state.difference - 0.2
					: this.playVideo.current.duration)
		) {
			this.progressBar.current.style.left = `${
				(time[index].start / this.playVideo.current.duration) * 100
			}%`;
			this.playVideo.current.currentTime = time[index].start;
			time[index]["end"] = seek;
			this.setState({ timings: time, playing: false });
		}
		this.progressBar.current.style.width = "0%";
	};

	renderGrabbers = () => {
		return this.state.timings.map((x, index) => (
			<div key={"grabber_" + index}>
				<div
					className="grabber start"
					title="Start"
					style={{
						left: `${
							(x.start / this.playVideo.current.duration) * 100
						}%`,
					}}
					onMouseDown={() => {
						if (this.state.deletingGrabber) {
							this.deleteGrabber(index);
						} else {
							this.setState(
								{
									currently_grabbed: {
										index: index,
										type: "start",
									},
								},
								() => {
									window.addEventListener(
										"mousemove",
										this.startGrabberMove
									);
								}
							);
						}
					}}
				></div>
				<div
					className="grabber end"
					title="End"
					style={{
						left: `${
							(x.end / this.playVideo.current.duration) * 100
						}%`,
					}}
					onMouseDown={(event) => {
						if (this.state.deletingGrabber) {
							this.deleteGrabber(index);
						} else {
							this.setState(
								{
									currently_grabbed: {
										index: index,
										type: "end",
									},
								},
								() => {
									window.addEventListener(
										"mousemove",
										this.startGrabberMove
									);
								}
							);
						}
					}}
				></div>
			</div>
		));
	};

	addGrabber = () => {
		var time = this.state.timings;
		var end = time[time.length - 1].end + this.state.difference;
		this.setState({ deletingGrabber: false });
		if (end >= this.playVideo.current.duration) {
			return;
		}
		time.push({ start: end + 0.2, end: this.playVideo.current.duration });
		this.setState({ timings: time }, () => {
			this.addActiveSegments();
		});
	};

	preDeleteGrabber = () => {
		if (this.state.deletingGrabber) {
			this.setState({ deletingGrabber: false });
		} else {
			this.setState({ deletingGrabber: true });
		}
	};

	deleteGrabber = (index) => {
		var time = this.state.timings;
		this.setState({
			timings: time,
			deletingGrabber: false,
			currently_grabbed: { index: 0, type: "start" },
		});
		if (time.length === 1) {
			return;
		}
		time.splice(index, 1);
		this.progressBar.current.style.left = `${
			(time[0].start / this.playVideo.current.duration) * 100
		}%`;
		this.playVideo.current.currentTime = time[0].start;
		this.progressBar.current.style.width = "0%";
		this.addActiveSegments();
	};

	addActiveSegments = () => {
		var colors = "";
		var counter = 0;
		colors += `, rgb(240, 240, 240) 0%, rgb(240, 240, 240) ${
			(this.state.timings[0].start / this.playVideo.current.duration) *
			100
		}%`;
		for (let times of this.state.timings) {
			if (counter > 0) {
				colors += `, rgb(240, 240, 240) ${
					(this.state.timings[counter - 1].end /
						this.playVideo.current.duration) *
					100
				}%, rgb(240, 240, 240) ${
					(times.start / this.playVideo.current.duration) * 100
				}%`;
			}
			colors += `, #ccc ${
				(times.start / this.playVideo.current.duration) * 100
			}%, #ccc ${(times.end / this.playVideo.current.duration) * 100}%`;
			counter += 1;
		}
		colors += `, rgb(240, 240, 240) ${
			(this.state.timings[counter - 1].end /
				this.playVideo.current.duration) *
			100
		}%, rgb(240, 240, 240) 100%`;
		this.playBackBar.current.style.background = `linear-gradient(to right${colors})`;
	};

	render = () => {
		return (
			<div className="wrapper">
				<video
					className="video"
					autoload="metadata"
					muted={this.state.isMuted}
					ref={this.playVideo}
					onClick={this.play_pause.bind(this)}
				>
					<source src={this.props.videoUrl} type="video/mp4" />
				</video>
				<div className="playback">
					{this.renderGrabbers()}
					<div
						className="seekable"
						ref={this.playBackBar}
						onClick={this.updateProgress}
					></div>
					<div className="progress" ref={this.progressBar}></div>
				</div>
				<div className="controls">
					<div className="player-controls">
						<button
							className="settings-control"
							title="Mute/Unmute Video"
							onClick={() =>
								this.setState({ isMuted: !this.state.isMuted })
							}
						>
							{this.state.isMuted ? (
								<FontAwesomeIcon icon={faVolumeMute} />
							) : (
								<FontAwesomeIcon icon={faVolumeUp} />
							)}
						</button>
					</div>
					<div className="player-controls">
						<button
							className="play-control"
							title="Play/Pause"
							onClick={this.play_pause.bind(this)}
						>
							{this.state.playing ? (
								<FontAwesomeIcon icon={faPause} />
							) : (
								<FontAwesomeIcon icon={faPlay} />
							)}
						</button>
					</div>
					<div>
						<button
							title="Add grabber"
							className="trim-control margined"
							onClick={this.addGrabber}
						>
							ADD ||
						</button>
						<button
							title="Delete grabber"
							className="trim-control margined"
							onClick={this.preDeleteGrabber}
						>
							DELETE ||
						</button>
					</div>
          <div>
						<button
							title="Save changes"
							className="trim-control"
							onClick={this.converter}
						>
							CONVERT
						</button>
          </div>
				</div>
				<hr />
				{this.state.videoReady
					? this.state.downloadVideo.map((e, i) => {
							return (
								<video
									width="320"
									height="180"
									controls
									controlsList="noplaybackrate"
									disablePictureInPicture
									key={"video" + i}
								>
									<source src={e} type="video/mp4" />
								</video>
							);
					  })
					: ""}
			</div>
		);
	};
}

export default Editor;
