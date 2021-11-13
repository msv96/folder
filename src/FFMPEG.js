import React, { useState, useEffect } from "react";
import { createFFmpeg, fetchFile } from "@ffmpeg/ffmpeg";

const ffmpeg = createFFmpeg({ log: true });

function FFMPEG() {
	const [ready, setReady] = useState(false);
	const [video, setVideo] = useState();
	const [gif, setGif] = useState();

	const load = async () => {
		await ffmpeg.load();
		setReady(true);
	};

	useEffect(() => {
		load();
	}, []);

	const convertToGif = async () => {
    setGif();
		ffmpeg.FS("writeFile", "test.mp4", await fetchFile(video));
		await ffmpeg.run(
			"-i",
			"test.mp4",
			"-t",
			"5.0",
			"-ss",
			"5.0",
			"-f",
			"mp4",
			"out.mp4"
		);
		const data = ffmpeg.FS("readFile", "out.mp4");
		const url = URL.createObjectURL(
			new Blob([data.buffer], { type: "image/mp4" })
		);
		setGif(url);
	};

	return ready ? (
		<div>
			{video && (
				<video
					controls
					width="250"
					src={URL.createObjectURL(video)}
				></video>
			)}
			<input
				type="file"
				onChange={(e) => setVideo(e.target.files?.item(0))}
			/>
			<h3>Result</h3>
			<button onClick={convertToGif}>Convert</button>
			{gif && <video controls width="640">
        <source src={gif} type="video/mp4" /></video>}
		</div>
	) : (
		<p>Loading...</p>
	);
}

export default FFMPEG;
