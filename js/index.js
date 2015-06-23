// var curVideoId = 'k6U-i4gXkLM';
var curVideoId = 'lZ3bPUKo5zc';
var player;
var windowWidth;
var ytLoaded = false;

window.onYouTubeIframeAPIReady = function() {
	console.log("YouTube API Ready");

    player = new YT.Player('player', { // TODO: Sometimes this doesn't work
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

    ytLoaded = true;

    if (windowWidth) { // if document loaded first
    	resizePlayer();
    }
};

function resizePlayer() {
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
	xhr.send();	// TODO: Make this async, and wrap everything else in xhr.onSuccess

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

	return clean;
}

var punctuation = ['.', '?', '!'];

function cleanTranscript(lines) {
	var clean = [];
	var cur = {};
	var curSentenceLen = 0, curdur = 0;
	var PAR_THRESHOLD = 250; // TODO: this should vary with the speaker's speaking speed

	cur.txt = "";

	for (var i = 0; i < lines.length; i++) {
		var line = lines[i].txt;
		line = cleanLine(line);

		if (cur.txt == "") {
			cur.sta = lines[i].sta;
		}

		cur.txt += (line + " ");
		curSentenceLen++;
		curdur += lines[i].dur;

		if (punctuation.indexOf(line.slice(-1)) != -1) {
			var endPar = false;
			var curWordLen = cur.txt.split(" ").length;
			// if words_per_second^1.5 * curlen > threshold, start a new paragraph
			var score = 1 / Math.pow(curWordLen, .2) * Math.pow(curdur, 1.3) * Math.pow(curSentenceLen, 2);
			if (score > PAR_THRESHOLD) {
				endPar = true;
				curSentenceLen = 0;
			}

			if (endPar) {
				cur.txt += "<br><br>&nbsp;&nbsp;&nbsp;&nbsp;";
			}

			if (curWordLen < 4) { // join short lines with previous line
				var tmp = clean[clean.length-1].txt.split('<br><br>&nbsp;'); // get section before new line
				if (tmp.length > 1) {
					console.log(tmp);
					// console.log(tmp + cur.txt + "<br>");
					clean[clean.length-1].txt = tmp[0] + cur.txt + "<br><br>&nbsp;&nbsp;&nbsp;&nbsp;"
				}
				else {
					clean[clean.length-1].txt = tmp + cur.txt;
				}				
			}
			else {
				clean.push(JSON.parse(JSON.stringify(cur)));
			}
			cur.txt = ""; // Reset
			curdur = 0;
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
		var dur = parseFloat(nodes[i].getAttribute("dur"));
		var start = nodes[i].getAttribute("start");
		var text = nodes[i].innerHTML;
		// console.log(dur + " " + start + " " + text);

		var cur = {};
		cur.dur = dur;
		cur.sta = start;
		cur.txt = text;
		lines.push(cur);
	}	

	var speakerNames = getSpeakerNames(lines); // call on uncleaned version
	// var new_par = "<br>&nbsp;&nbsp;&nbsp;&nbsp;";
	var new_par = "<br><br>";
	for (var i = 0; i < lines.length; i++) {
		var tmp = lines[i].txt.split(':')[0];
		if (speakerNames.indexOf(tmp) != -1) {
			lines[i].txt = new_par + lines[i].txt;  
			// console.log(lines[i].txt);
		}
	}

	// console.log(speakerNames);

	var clean = cleanTranscript(lines);

	for (var i = 0; i < clean.length; i++) {
		var iSpan = document.createElement("span");
		iSpan.id = "caption" + i;
		iSpan.onclick = (function(j) {
			return function() {
				setVideoTime(clean[j].sta);
			};
		})(i);

		// iSpan.setAttribute("data-time", clean[i].sta);
		//iSpan.setAttribute("onclick", "setVideoTime(" + clean[i].sta + ")");;
		iSpan.innerHTML = clean[i].txt;
		transcriptDiv.appendChild(iSpan);
	}
}

function getSpeakerNames(lines) {
	var cnts = {};
	var names = [];
	var i, line;
	for (i = 0; i < lines.length; i++) {
		line = lines[i].txt;
		if (line.indexOf(':') != -1) {
			var speaker = line.split(':')[0];
			if (speaker in cnts) {
				cnts[speaker]++;
			}
			else {
				cnts[speaker] = 1;
			}
		}
	}
	for (key in cnts) {
		if (cnts[key] >= 3) { // arbitrary const
			names.push(key);
		}
	}
	return names;
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

function setDefaultWidths() {
	console.log("setDefaultWidths");
	var x1 = .5 * windowWidth - 22;
	document.getElementById("left").style.width = x1.toString() + "px";
	document.getElementById("resize-handle").style.left = x1.toString() + "px";
	document.getElementById("right").style.width = (.5 * windowWidth - 2).toString() + "px";
}

$(document).ready(function() {
	loadTranscript();
	resizePanels();
	windowWidth = $(window).width();
	setDefaultWidths();
    // $('body').layout({ applyDefaultStyles: true });


	if (ytLoaded) { // if YouTube API loaded first
		resizePlayer(); 
	}
	// onYouTubeIframeAPIReady();
});

 var tag = document.createElement('script');
 tag.src = "https://www.youtube.com/iframe_api";
 var firstScriptTag = document.getElementsByTagName('script')[0];
 firstScriptTag.parentNode.insertBefore(tag, firstScriptTag);