// var curVideoId = 'k6U-i4gXkLM';
var curVideoId = 'lZ3bPUKo5zc';
var player;

function onYouTubeIframeAPIReady() {
    player = new YT.Player('player', {
        videoId: curVideoId,
        playerVars: {
            controls: 1,
            autoplay: 0,
            disablekb: 1,
            enablejsapi: 1,
            iv_load_policy: 3,
            // modestbranding: 1,
            showinfo: 1
        }
    });
}

function loadVideo() {
	var ytUrl = document.getElementById("yt-link").value;
	var ytId = getYoutubeId(ytUrl);
	var embedStr = 'http://www.youtube.com/embed/' + ytId;

	curVideoId = ytId;
	player.loadVideoById(ytId);

	loadTranscript();
	// document.getElementById("video-frame").src = embedStr;
}

function getYoutubeId(url) {
    var regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
    var match = url.match(regExp);

    if (match && match[2].length == 11) {
        return match[2];
    } else {
        return 'error';
    }
}

function getTranscriptXML(ytId) {
	var xhr = new XMLHttpRequest();
	var async = false;
	xhr.open("GET", "http://www.youtube.com/api/timedtext?lang=en&v=" + ytId, async);
	xhr.send()

	// console.log(xhr);

	// TODO: Catch errors if manual transcript is unavailable
	return xhr.responseXML.firstChild;
}

function cleanTranscript(lines) {
	var clean = [];
	var cur = {};
	for (var i = 0; i < lines.length; i++) {
		var line = lines[i].txt;
		// line = line.replace(/\s+/g, ''); // I don't believe trimming whitespace is necessary
		if (line.slice(-1) == '.') {
			
		}
	}
}

function loadTranscript() {
	console.log("loadTranscript");
	var xml = getTranscriptXML(curVideoId);

	var transcriptDiv = document.getElementById("transcript");
	transcriptDiv.innerHTML = "";

	var nodes = xml.getElementsByTagName("text");
	
	var lines = [];
	for (var i = 0; i < nodes.length; i++) {
		var dur = nodes[i].getAttribute("dur");
		var start = nodes[i].getAttribute("start");
		var text = nodes[i].innerHTML;
		// console.log(dur + " " + start + " " + text);

		var cur = {};
		cur.dur = dur;
		cur.sta = start;
		cur.txt = text;
		lines.push(cur);

		// var iDiv = document.createElement("span");
		// iDiv.id = "caption" + i;
		// iDiv.innerHTML = text + " ";

		// transcriptDiv.appendChild(iDiv);
	}	
	var clean = cleanTranscript(lines);
}

$(document).ready(loadTranscript);