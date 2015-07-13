// var curVideoId = 'Ei8CFin00PY';
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
	// console.log("YouTube API Ready");

    player = new YT.Player('player', {
        videoId: curVideoId,
        playerVars: {
            controls: 1,
            autoplay: 0,
            disablekb: 1,
            enablejsapi: 1
        }
    });	

    ytLoaded = true;

    if (windowWidth) { // if document loaded first
    	resizePlayer();
    	setVideoTitle();
		window.setInterval(function(){
	  		seekToActiveCaption(0);
		}, 100);
    }

    // console.log("Done Loading");
};

function setVideoTitle(ytId) {
	var xhr = new XMLHttpRequest();
	var async = true;
	xhr.onload = function(e) {
		// TODO: This has errors sometimes
		// console.log("HELLO");
    	if (xhr.readyState==4 && xhr.status==200) {
			var data = JSON.parse(xhr.response);
			// console.log(data);
			if (data.items[0]) {
				var title = data.items[0].snippet.title;
				document.title = "YT Skimmer | " + title;	
			}
    	}
	};
	xhr.onerror = function(e) {
		console.error(xhr.statusText);
	};
	xhr.open("GET", "https://www.googleapis.com/youtube/v3/videos?part=snippet&id=" 
		+ ytId + "&key=" + API_KEY, async);
	xhr.send();
}

function resizePlayer() {
	$(document).ready(function() {
		windowWidth = domWindow.width();
		var shadingHeight = $(".shading").height();
		// console.log("resizePlayer");
		var playerWidth = Math.min(5.5 * windowWidth / 12, shadingHeight * .9 * 4/3);
		var playerHeight = 3 * playerWidth / 4.0;

		var nodePlayer = $("player");
		nodePlayer.width(playerWidth);

		player.setSize(playerWidth, playerHeight);
	});
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
	var punctuation = ['.', '?', '!'];
	var clean = [];
	var cur = {};
	var curSentenceLen = 0, curdur = 0;
	var PAR_THRESHOLD = 250; // TODO: this should vary with the speaker's speaking speed

	cur.txt = "";

	lines[0].beginPar = true;
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
		// if (lines[i].beginPar) console.log(cur.txt);
		
		if (i == lines.length - 1) { // push everything else
			clean.push(JSON.parse(JSON.stringify(cur)));
			cur.txt = "";
			curdur = 0;
		}
		else if (punctuation.indexOf(line.slice(-1)) != -1) {
			cur.endPar = false;
			var curWordLen = cur.txt.split(" ").length;
			// if words_per_second^1.5 * curlen > threshold, start a new paragraph
			var score = 1 / Math.pow(curWordLen, .2) * Math.pow(curdur, 1.3) * Math.pow(curSentenceLen, 2);
			if (score > PAR_THRESHOLD) {
				cur.endPar = true;
				curSentenceLen = 0;
			}

			if (curWordLen < 4 && !cur.beginPar) { // join short lines with previous line 
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
	var linesManual = [], 
		linesAuto = [];
	var xhrMan, xhrAuto;

	function onTranscriptUnavailable() {
		console.log(xhrMan);
		console.log("Neither transcript available");
		return;
	}

	function getManualTranscript(ytId) {
		xhrMan = $.ajax({
			'url': "http://www.youtube.com/api/timedtext?lang=en&v=" + ytId,
			'async': true,
			'success': function(xml) {
	    		xhrAuto.abort();

	    		lines = []
				$(xml).find('transcript').find('text').each(function(){
					var cur = {};
					cur.txt = this.innerHTML;
					cur.dur = parseFloat(this.getAttribute('dur'));
					cur.sta = parseFloat(this.getAttribute('start'));
					lines.push(cur);
				});

				$(document).ready(function() {
					loadLinesIntoDOM(lines);		
				});
			},
			'error': function(xhr, error) {
				console.debug(xhr);
				console.debug(error);
			},
			'timeout': 1000
		});
	}

	function getAutoTranscript(ytId) {
		xhrAuto = $.ajax({
			"url": "/api/auto_captions/" + ytId,
			"async": true
		});
		xhrAuto.done(function(html) {

			var afterManualLoads = (function(htmljson) {
				console.log("evaluated after xhrAutoDone");
				return function() {
					console.log("after man finishes");
					console.log(xhrMan);
		    		if (xhrMan.readyState==4 && xhrMan.status==200) {
						console.log("Manual finished after auto");
		    			return;
					}
					else {
						if (htmljson.timeout) {
							return onTranscriptUnavailable();
						}
						console.log("Loading auto lines");
						var lines = htmljson.transcript.text;
						var cur, line;
						for (var i = 0; i < lines.length; i++) {
							cur = {};
							line = lines[i];
							cur.sta = line.$.start;
							cur.dur = line.$.dur;
							cur.txt = line._;
							linesAuto.push(JSON.parse(JSON.stringify(cur)));
						}
						console.log("load auto liens");
						loadLinesIntoDOM(linesAuto);
					}
				};
			})(html);

			$.when(xhrMan).then(afterManualLoads, afterManualLoads); 
		});
	}

	getManualTranscript(curVideoId);
	getAutoTranscript(curVideoId);
}

function loadLinesIntoDOM(lines) {
	var speakerNames = getSpeakerNames(lines); // call on uncleaned version
	// var new_par = "<br>&nbsp;&nbsp;&nbsp;&nbsp;";

	for (var i = 0; i < lines.length; i++) {
		var tmp = lines[i].txt.split(':')[0];
		if (speakerNames.indexOf(tmp) != -1) {
			lines[i].beginPar = true;
		}
	}

	var clean = cleanTranscript(lines);
	
	var transcriptDiv = document.getElementById("transcript");
	transcriptDiv.innerHTML = "";

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
	return 1;
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
	if (curCaptionDivs.length == 0) return;
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

	if (ytLoaded) { // if YouTube API loaded first
		resizePlayer(); 
		setVideoTitle(curVideoId);
		window.setInterval(function(){
	  		seekToActiveCaption(0);
		}, 100);	
	}

	// $("#help-icon").click(function() {
	// 	console.log("Help icon clicked");
	// 	if (!($("#help-popover").is(":visible"))) {
	// 		console.log("Hidden");
	// 		$("#help-popover").show();
	// 	}
	// });

	$(document).click(function(event) {
		if ($("#help-popover").is(":visible")) {
			console.log("visible");
			if (!($(event.target).closest('#instructions').length)) {
				$("#help-popover").hide();
			}
		}
		else {
			if ($(event.target).closest('#help-icon').length) {
				$("#help-popover").show();
			}
		}
	});
});

function seekToActiveCaption(forceScroll) {
	if (!player.getCurrentTime) return;
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
 	console.log("resize");
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

function getYoutubeId(url) {
    var regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
    var match = url.match(regExp);

    if (match && match[2].length == 11) {
        return match[2];
    } else {
        return 'error';
    }
}

function loadVideoFormSubmit() {
	var ytLink = document.getElementById("yt-link");
	var ytUrl = ytLink.value;
	if (ytUrl.trim().length == 0) {
		return false;
	}
	ytLink.value = getYoutubeId(ytUrl);
	return true;
}