// var curVideoId = 'k6U-i4gXkLM';
var curVideoId = 'lZ3bPUKo5zc';
var player;
var windowWidth;

function onYouTubeIframeAPIReady() {
	console.log("ready");
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

    console.log("loadVid");
    $(document).ready(function() {
		var playerWidth = .4 * windowWidth;
		player.setSize(playerWidth, 9 * playerWidth / 16.0);
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

function cleanLine(line) {
	var clean = line;
	clean = clean.replace(/&amp;/g, "&");
	clean = clean.replace(/&lt;/g, "<");
	clean = clean.replace(/&gt;/g, ">");
	clean = clean.replace(/&quot;/g, '"');
	clean = clean.replace(/&#37;/g, "%");
	clean = clean.replace(/&#39;/g, "'");

	// console.log(clean);
	return clean;
}

var punctuation = ['.', '?', '!'];

function cleanTranscript(lines) {
	var clean = [];
	var cur = {};
	cur.txt = "";
	for (var i = 0; i < lines.length; i++) {
		var line = lines[i].txt;
		line = cleanLine(line);

		// line = line.replace(/\s+/g, ''); // I don't believe trimming whitespace is necessary
		if (cur.txt == "") {
			cur.sta = lines[i].sta;
		}

		cur.txt += (line + " ");

		if (punctuation.indexOf(line.slice(-1)) != -1) {
			clean.push(JSON.parse(JSON.stringify(cur)));
			cur.txt = ""; // Reset
		}
	}

	return clean;
}

function setVideoTime(sec) {
	player.seekTo(sec, true);
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

	for (var i = 0; i < clean.length; i++) {
		var iSpan = document.createElement("span");
		iSpan.id = "caption" + i;
		// iSpan.setAttribute("data-time", clean[i].sta);
		iSpan.setAttribute("onclick", "setVideoTime(" + clean[i].sta + ")");;
		iSpan.innerHTML = clean[i].txt;
		transcriptDiv.appendChild(iSpan);
	}
}

function resizePanels() {
	console.log("resizePanels");

	var origLeftWidth, origRightWidth;

	$("#resize-handle").draggable({
		axis: 'x',
		start: function(event, ui) {
			origLeftWidth = $("#left").width();
			origRightWidth = $("#right").width();
		},
		drag: function(event, ui) {
			var lWidth = origLeftWidth + (ui.position.left - ui.originalPosition.left);
			player.setSize(lWidth, 9 * lWidth / 16.0);
			$("#left").width(lWidth);
			$("#right").width(origRightWidth - (ui.position.left - ui.originalPosition.left));
		},
		// stop: function(event, ui) {

		// },
		containment: "parent"
		
	});
}


$(document).ready(function() {
	loadTranscript();
	resizePanels();
	windowWidth = $(window).width();
	onYouTubeIframeAPIReady();
});
