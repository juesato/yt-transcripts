var curVideoId = 'Ei8CFin00PY';
// var curVideoId = 'lZ3bPUKo5zc';
var player;
var domWindow, windowWidth, windowHeight;
var ytLoaded = false;
var API_KEY = "AIzaSyDpIPdx2BEmRMkYIF_2PVmnMN6-toj-klA";

var NEW_PAR_STR = "<br><br>&nbsp;&nbsp;&nbsp;&nbsp;";

var curCaptionDivs = [];
var curCaptionTimes = [];
var focusedLine = -1;
var maintainPosition = true;
var autoscrolling = false;

window.onYouTubeIframeAPIReady = function() {
	console.log("YouTube API Ready");

    player = new YT.Player('player', {
        videoId: curVideoId,
        playerVars: {
            controls: 1,
            autoplay: 0,
            disablekb: 1,
            enablejsapi: 1,
            // iv_load_policy: 3,
            // modestbranding: 1,
            // showinfo: 1
        }
    });	

    ytLoaded = true;

    if (windowWidth) { // if document loaded first
    	resizePlayer();
    	setVideoTitle();
    }

    console.log("Done Loading");
};

function getVideoTitle(ytId) {
	var xhr = new XMLHttpRequest();
	var async = false;
	xhr.open("GET", "https://www.googleapis.com/youtube/v3/videos?part=snippet&id=" 
		+ ytId + "&key=" + API_KEY, async);
	xhr.send();	// TODO: Make this async, and wrap everything else in xhr.onSuccess

	var data = JSON.parse(xhr.response);

	return data.items[0].snippet.title;
}

function setVideoTitle() {
	var title = getVideoTitle(curVideoId);
	// var domTitle = document.getElementById("video-title");
	// domTitle.innerHTML = title;
	document.title = title + " - YtSkimmer";
}

function resizePlayer() {
	$(document).ready(function() {
		windowWidth = domWindow.width();
		// console.log("resizePlayer");
		var playerWidth = 5.5 * windowWidth / 12;
		var playerHeight = 3 * playerWidth / 4.0;

		var nodePlayer = $("player");
		nodePlayer.width(playerWidth);

		player.setSize(playerWidth, playerHeight);
	});
}

function loadVideo() {
	console.log("loadVideo");

	var ytUrl = document.getElementById("yt-link").value;
	var ytId = getYoutubeId(ytUrl);
	var embedStr = 'http://www.youtube.com/embed/' + ytId;

	curVideoId = ytId;
	player.loadVideoById(ytId);

	loadTranscript();
	setVideoTitle();
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
	if (!xhr.responseXML) {
		// console.log("No manual transcript available");
		return -1;
	}
	return xhr.responseXML.firstChild;
}

function getAutoTranscript(ytId) {
	var transcript = [];
	var xmlReq = $.ajax({
		"url": "/api/auto_captions/" + ytId,
		"async": false
	});
	xmlReq.done(function(html) {
		console.log(html);

		var lines = html.transcript.text;
		var cur, line;
		for (var i = 0; i < lines.length; i++) {
			cur = {};
			line = lines[i];
			cur.sta = line.$.start;
			cur.dur = line.$.dur;
			cur.txt = line._;
			transcript.push(JSON.parse(JSON.stringify(cur)));
		}
	});
	console.log(transcript);
	return transcript;
}

function cleanLine(line) {
	var clean = line.trim();
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

		cur.beginPar = lines[i].beginPar;
		cur.endPar = lines[i].endPar;
		
		if (i == lines.length - 1) { // push everything else
			console.log("END");
			clean.push(JSON.parse(JSON.stringify(cur)));
			cur.txt = "";
			curdur = 0;
		}
		else if (punctuation.indexOf(line.slice(-1)) != -1) {
			var endPar = false;
			var curWordLen = cur.txt.split(" ").length;
			// if words_per_second^1.5 * curlen > threshold, start a new paragraph
			var score = 1 / Math.pow(curWordLen, .2) * Math.pow(curdur, 1.3) * Math.pow(curSentenceLen, 2);
			if (score > PAR_THRESHOLD) {
				endPar = true;
				curSentenceLen = 0;
			}

			if (endPar) {
				// cur.txt += "<br><br>&nbsp;&nbsp;&nbsp;&nbsp;";
				cur.endPar = true;
			}

			if (curWordLen < 4) { // join short lines with previous line 
				// TODO: what if it's the first line?
				var tmp = clean[clean.length-1].txt.split(NEW_PAR_STR); // get section before new line
				if (tmp.length > 1) {
					clean[clean.length-1].txt = tmp[0] + cur.txt + NEW_PAR_STR;
				}
				else {
					clean[clean.length-1].txt = tmp + cur.txt;
				}				
			}
			else { // add on new line
				// console.log(cur);
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

	var lines = [];

	if (xml == -1) { // No transcript available
		var iSpan = document.createElement("span");		
		// iSpan.innerHTML = "Sorry, no manual transcript is available";
		iSpan.innerHTML = "The follow transcript is automatically generated: \n\n"
		transcriptDiv.appendChild(iSpan);

		lines = getAutoTranscript(curVideoId);
		// return;
	}
	else {
		var nodes = xml.getElementsByTagName("text");
		
		for (var i = 0; i < nodes.length; i++) {
			var dur = parseFloat(nodes[i].getAttribute("dur"));
			var start = nodes[i].getAttribute("start");
			var text = nodes[i].innerHTML;

			var cur = {};
			cur.dur = dur;
			cur.sta = start;
			cur.txt = text;
			lines.push(cur);
		}			
	}

	console.log("lines");
	console.log(lines);

	var speakerNames = getSpeakerNames(lines); // call on uncleaned version
	// var new_par = "<br>&nbsp;&nbsp;&nbsp;&nbsp;";

	for (var i = 0; i < lines.length; i++) {
		var tmp = lines[i].txt.split(':')[0];
		if (speakerNames.indexOf(tmp) != -1) {
			lines[i].beginPar = true;
		}
	}


	var clean = cleanTranscript(lines);

	console.log("clean");
	console.log(clean);

	curCaptionTimes.length = 0;
	curCaptionDivs.length = 0;

	for (var i = 0; i < clean.length; i++) {
		var iSpan = document.createElement("span");
		iSpan.id = "caption" + i;
		iSpan.class = "caption";
		iSpan.onclick = (function(j) {
			return function() {
				setVideoTime(clean[j].sta);
				maintainPosition = true;
			};
		})(i);

		// var caption = clean[i].txt.split(NEW_PAR_STR);
		// iSpan.innerHTML = caption[0];
		iSpan.innerHTML = clean[i].txt;
		transcriptDiv.appendChild(iSpan);

		if (i < clean.length - 1 && (clean[i].endPar || clean[i+1].beginPar)) {
			var parBreak = document.createElement("span");
			parBreak.class = "parBreak";
			parBreak.id = "parBreak" + i;
			parBreak.innerHTML = NEW_PAR_STR;
			transcriptDiv.appendChild(parBreak);
		}

		curCaptionDivs.push(iSpan);
		curCaptionTimes.push(clean[i].sta);

	}
}

function upper_bound(val, arr, first, last) {
    if (arguments.length == 2) {
    	return upper_bound(val, arr, 0, arr.length);
    }
    if (last - first <= 2) {
    	while (first < arr.length-1 && arr[first+1] <= val) first++;
    	return first;
    }

    var idx = Math.floor((first+last)/2);
    if (arr[idx] > val) return upper_bound(val, arr, first, idx-1);
    else return upper_bound(val, arr, idx, last);
}

function getCaptionFromTime(time) {
	return upper_bound(time, curCaptionTimes);
}

function focusCaption(newLine) {
	if (focusedLine != -1) curCaptionDivs[focusedLine].style.color = "black";
	focusedLine = newLine;
	curCaptionDivs[focusedLine].style.color = "red";
	if (maintainPosition) {
		autoscrolling = true;
		scrollToCaption(focusedLine);
		setTimeout(function(){autoscrolling = false;}, 50);
	}
}

function scrollToCaption(caption) {
	$("#right").scrollTop(curCaptionDivs[caption].offsetTop - .2 * windowHeight);
	// autoscrolling = false;
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
		containment: "parent"
		
	});
}

function setDefaultWidths() {
	console.log("setDefaultWidths");
	var x1 = .5 * windowWidth - 22;
	document.getElementById("left").style.width = x1.toString() + "px";
	// document.getElementById("resize-handle").style.left = x1.toString() + "px";
	document.getElementById("right").style.width = (.5 * windowWidth - 2).toString() + "px";
}

$(document).ready(function() {
	loadTranscript();
	domWindow = $(window);
	windowWidth = domWindow.width();
	windowHeight = domWindow.height();
    // $('body').layout({ applyDefaultStyles: true });


	if (ytLoaded) { // if YouTube API loaded first
		resizePlayer(); 
		setVideoTitle();
	}

	var tooltipOptions = {
		"html": true,
		"placement": "bottom",
		"trigger": "click"
	};
	$("#help").tooltip(tooltipOptions);

	window.setInterval(function(){
  		seekToActiveCaption(0);
	}, 100);

});

function seekToActiveCaption(forceScroll) {
	var time = player.getCurrentTime();
	var curCapt = getCaptionFromTime(time);
	if (curCapt != focusedLine || forceScroll) focusCaption(curCapt);	
}

$("#right").scroll(function() {
	if (!autoscrolling) {
		maintainPosition = false;
		// console.log("detected manual scrolling");
	}
	else {
		// console.log("autoscroll");
		autoscrolling = false;		
	}
});

var tag = document.createElement('script');
tag.src = "https://www.youtube.com/iframe_api";
var firstScriptTag = document.getElementsByTagName('script')[0];
firstScriptTag.parentNode.insertBefore(tag, firstScriptTag);

var resizeId;
window.onresize = function() {
 	clearTimeout(resizeId);
 	resizeId = setTimeout(resizePlayer(), 100);
}

document.onkeypress = function (e) {
    e = e || window.event;
    if (e.keyCode == 82 || e.keyCode == 114) { // 'r' 'R'
    	maintainPosition = true;
  		seekToActiveCaption(true);
    }
    if (e.keyCode == 32) { // space for start/stop
    	console.log("startstop");
    	if (player.getPlayerState() == 1) { // 1 is the code for playing
    		player.pauseVideo();
    	}
    	else {
    		player.playVideo();
    	}

    }
};