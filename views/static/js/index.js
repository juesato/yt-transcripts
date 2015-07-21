// var curVideoId = 'Ei8CFin00PY';
// var curVideoId = 'lZ3bPUKo5zc';
var player;
var domWindow, windowWidth, windowHeight;
var ytLoaded = false;
var currentlyEditing;
var API_KEY = "AIzaSyDpIPdx2BEmRMkYIF_2PVmnMN6-toj-klA";

var NEW_PAR_STR = "<br><br>&nbsp;&nbsp;&nbsp;&nbsp;";
var NEW_SEC_STR = "<br><br>";

var CLICKDELAY = 400;

var numCaptions;
var curCaptionDivs = [];
var curCaptionTimes = [];

var focusedLine = -1;
var lastActiveArrowButton;
var hideArrowTimeout;
var maintainPosition = true;
var autoscrolling = false;
var curLineUnedited;



window.onYouTubeIframeAPIReady = function() {

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
    if (windowWidth) {
    	document.body.dispatchEvent(ytDocLoadEvent);
    }
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
	var leftWidth = $("#left").width();
	var shadingHeight = $("#shading").height();
	// console.log("resizePlayer");
	var playerWidth = Math.min(.95 * leftWidth, shadingHeight * .9 * 4/3);
	var playerHeight = 3 * playerWidth / 4.0;

	var nodePlayer = $("player");
	nodePlayer.width(playerWidth);

	player.setSize(playerWidth, playerHeight);
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

function processManualTranscript(lines) {
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
			cur.beginPar = lines[i].beginPar;
		}

		cur.txt += (line + " ");
		curSentenceLen++;
		curdur += lines[i].dur;
		if (i == lines.length - 1) { // push everything else
			cur.endPar = true;
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
				cur.endPar = cur.endPar || lines[i].endPar;
				clean.push(JSON.parse(JSON.stringify(cur)));
			}
			cur.txt = ""; // Reset
			curdur = 0;
		}

	}
	return clean;
}

function processAutoTranscript(lines) {
	var clean = [];
	for (var i = 0; i < lines.length; i++) {
		var line = lines[i];
		line.txt = cleanLine(line.txt);
		line.beginPar = true;
		line.sta = lines[i].sta;
		clean.push(line);
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
				loadLinesIntoDOM(lines, true);		
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
				return function() {
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
						loadLinesIntoDOM(linesAuto, false);
					}
				};
			})(html);

			$.when(xhrMan).then(afterManualLoads, afterManualLoads); 
		});
	}

	getManualTranscript(curVideoId);
	getAutoTranscript(curVideoId);
}

function loadLinesIntoDOM(lines, isManual) {
	var speakerNames = getSpeakerNames(lines); // call on uncleaned version

	for (var i = 0; i < lines.length; i++) {
		var tmp = lines[i].txt.split(':')[0];
		if (speakerNames.indexOf(tmp) != -1) {
			lines[i].beginPar = true;
		}
	}
	if (isManual) {
		var clean = processManualTranscript(lines);
	}
	else {
		var clean = processAutoTranscript(lines);
	}
	
	var transcriptDiv = document.getElementById("transcript");
	transcriptDiv.dataset.source = isManual ? "yt_manual" : "yt_auto";
	transcriptDiv.dataset.edited = false;
	transcriptDiv.innerHTML = "";

	curCaptionTimes.length = 0;
	curCaptionDivs.length = 0;

	if (!isManual) {
		var transcriptType = document.createElement("span");
		transcriptType.className = "transcriptType";
		transcriptType.innerHTML = "This is an automatically generated transcript.<br><br>";
		transcriptDiv.appendChild(transcriptType);
	}

	for (var i = 0; i < clean.length-1; i++) {
		clean[i].endPar = clean[i].endPar || clean[i+1].beginPar;
		clean[i+1].beginPar = clean[i].endPar;
	}

	var curPar;
	for (var i = 0; i < clean.length; i++) {
		// console.log(clean[i].beginPar);
		if (clean[i].beginPar) {
			curPar = document.createElement("p");
		}
		var iSpan = document.createElement("span");
		iSpan.id = "caption" + i;
		iSpan.className = "caption";
		iSpan.innerHTML = clean[i].txt;
		iSpan.dataset.time = clean[i].sta;
		curPar.appendChild(iSpan);
		if (clean[i].endPar) {
			transcriptDiv.appendChild(curPar);
		}

		// if (i < clean.length - 1 && (clean[i].endPar || clean[i+1].beginPar)) {
		// 	var parBreak = document.createElement("span");
		// 	parBreak.className = "parBreak";
		// 	parBreak.id = "parBreak" + i;
		// 	parBreak.innerHTML = NEW_SEC_STR;
		// 	transcriptDiv.appendChild(parBreak);
		// }
	}

	document.body.dispatchEvent(transcriptLoadEvent);

	$.ajax({
		url:'/api/postTranscript',
		async: true,
		type: 'POST',
		data: {
			'transcript': clean,
			'ytId': curVideoId,
			'source': transcriptDiv.dataset.source,
			'edited': false
		},
		success: function(data) {
			console.log("Posted to DB");
		},
		error: function(err) {
			console.log("Couldn't post to DB");
			console.log(err);
		}	
	});
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

function makeCaptionEditable(s) {
	s.style.tabIndex = 1;
	s.setAttribute("contentEditable", true);
	s.focus();
	curLineUnedited = s.innerHTML;
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

function fadeOutActiveMergeParButton() {
	var active = $(".active-merge-button");
	active.fadeOut(100);
	active.removeClass("active-merge-button")
}

function onTranscriptLoad() {
	// sets up click, focus, blur handlers for captions
	// also defines curCaptionDivs and curCaptionTimes
	var captionDivs = document.getElementsByClassName("caption");
	for (var i = 0; i < captionDivs.length; i++) {
		var cur = captionDivs[i];
		cur.onfocus = function(s) {
			return function() {
				console.log("add editable");
				currentlyEditing = s;
				maintainPosition = false; // don't scroll while people are editing
				s.classList.add("editable");
			};
		}(cur);
		cur.onblur = function(s) {
			return function() {
				console.log("finished");
				var newText = s.innerHTML;
	    		if (newText != curLineUnedited) {
	    			console.log("modified the text");
	    			$("#editing").fadeIn(300);
	    		}
				currentlyEditing = null;
				maintainPosition = true;
				s.classList.remove("editable");
				s.style.tabIndex = -1;
				s.contentEditable = false;
			};
		}(cur);
		var time = parseFloat(cur.dataset.time);
		cur.onclick = (function(t, s) {
			var clicks = 0;
			return function () {
				if (s.classList.contains("editable")) {
					return; // they're already editing this
				}

				clicks++;
				if (clicks === 1) {
					timer = setTimeout(function() {
						setVideoTime(t);
						maintainPosition = true;
						clicks = 0;
					}, CLICKDELAY);
				}
				else {
					clearTimeout(timer);
					makeCaptionEditable(s);
					clicks = 0;
				}
			}
		})(time, cur);
		curCaptionDivs.push(cur);
		curCaptionTimes.push(time);
	}
	addMergeParButtons();
}

function addMergeParButtons() {
	// TODO: this section should really be done in backend
	var parDivs = document.getElementById("transcript").getElementsByTagName("p");
	numCaptions = parDivs.length;
	for (var i = 0; i < numCaptions; i++) {
		var cur = parDivs[i];
		cur.id = "par" + i;
		if (i == parDivs.length - 1) break;
		var arrowSpan = document.createElement("div");
		arrowSpan.className = "merge-par-button";
		var arrowup = document.createElement("img");
		arrowup.src = "/static/img/up_arrow.png";
		arrowup.className = "icon-arrow-up";
		var arrowdown = document.createElement("img");
		arrowdown.src = "/static/img/down_arrow.png";
		arrowdown.className = "icon-arrow-down";
		arrowSpan.appendChild(arrowdown);
		arrowSpan.appendChild(arrowup);
		arrowSpan.id = "arrow-button" + i;
		arrowSpan.onmouseenter = function(cur) {
			return function() {
				clearTimeout(hideArrowTimeout);
				hideArrowTimeout = setTimeout(function() {
					$(cur).fadeOut(800)
				}, 5000);
				var arrows = cur.childNodes;
				setOpacity(arrows[0], 1.0);
				setOpacity(arrows[1], 1.0);
			};
		}(arrowSpan);
		arrowSpan.onmouseleave = function(cur) {
			return function() {
				var arrows = cur.childNodes;
				setOpacity(arrows[0], 0.4);
				setOpacity(arrows[1], 0.4);
			};
		}(arrowSpan);

		arrowSpan.onclick = function(j, curPar) {
			return function() {
				var nextPar;
				while (!toInsert && j < numCaptions + 3) {
					nextPar = document.getElementById("par" + (j+1));
					if (nextPar) {
						var toInsert = nextPar.childNodes;
					}
					j++;					
				}
				var len = toInsert.length;
				for (var z = 0; z < len; z++) { // ignore last element, it's a button
					if (toInsert[z].id && toInsert[z].classList.contains("caption")) {
						$(curPar).append($("#" + toInsert[z].id));
						z--; // the element disappears from toInsert.length
						len--;
					}
				}
				nextPar.parentNode.removeChild(nextPar);
				$("#editing").fadeIn(300);
			};
		}(i, cur);

		cur.onmouseenter = function(cur) {
			return function() {
				fadeOutActiveMergeParButton();
				cur.classList.add("active-merge-button");
				if (cur != lastActiveArrowButton) {
					$(cur).fadeIn(100);					
				}
				hideArrowTimeout = setTimeout(function() {
					$(cur).fadeOut(800)
				}, 7000);
				lastActiveArrowButton = cur;
			}
		}(arrowSpan);

		cur.appendChild(arrowSpan);
	}
}

function setOpacity(domObj, opacity) {
	domObj.style.opacity = opacity;
	domObj.style.filter = "alpha(opacity=" + opacity*100 + ")";
}

function onYtAndDocReady() {
	resizePlayer();
	setVideoTitle();
	window.setInterval(function(){
  		seekToActiveCaption(0);
	}, 100);
}

var transcriptLoadEvent = new CustomEvent("transcriptLoadEvent");
document.body.addEventListener("transcriptLoadEvent", onTranscriptLoad, false);

var ytDocLoadEvent = new CustomEvent("ytDocLoadEvent");
document.body.addEventListener("ytDocLoadEvent", onYtAndDocReady, false);

function getCaptionsFromDOM() {
	var captions = [];
	var transcriptDiv = document.getElementById("transcript");
	var parDivs = transcriptDiv.getElementsByTagName("p");
	for (var i = 0; i < parDivs.length; i++) {
		var plines = parDivs[i].getElementsByClassName("caption");
		for (var j = 0; j < plines.length; j++) {
			var cur = {};
			cur.txt = plines[j].innerHTML;
			cur.sta = plines[j].dataset.time;
			cur.beginPar = (j == 0);
			cur.endPar = (j == plines.length - 1);
			captions.push(JSON.parse(JSON.stringify(cur)));
		}
	}
	return captions;	
}

$(document).ready(function() {
	if (!transcriptLoaded) {
		loadTranscript();
	}
	else {
		document.body.dispatchEvent(transcriptLoadEvent);
	}
	if (ytLoaded) {
		document.body.dispatchEvent(ytDocLoadEvent);
	}
	domWindow = $(window);
	windowWidth = domWindow.width();
	windowHeight = domWindow.height();
});

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

$("#close-edits").click(function() {
	$("#editing").fadeOut(300);
});

$("#save-changes").click(function() {
	var fadeOutTime = 300;
	var fadeInTime = 300;
	var displayTime = 3000;
	$("#editing").fadeOut(fadeOutTime);
	setTimeout(function() {
		$("#thanks").fadeIn(fadeInTime);
		setTimeout(function() {
			$("#thanks").fadeOut(fadeOutTime);
		}, displayTime);
	}, fadeOutTime + 200);

	// post to DB
	var transcriptDiv = document.getElementById("transcript");
	var captions = getCaptionsFromDOM();
	$.ajax({
		url:'/api/postTranscript',
		async: true,
		type: 'POST',
		data: {
			'transcript': captions,
			'ytId': curVideoId,
			'source': transcriptDiv.dataset.source,
			'edited': true
		},
		success: function(data) {
			console.log("Posted to DB");
		},
		error: function(err) {
			console.error(err);
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
	}
	else {
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

var keysDown = [];
document.onkeyup = function(e) {
	e = e || event;
	keysDown[e.keyCode] = e.type == 'keydown';
}

document.onkeydown = function(e) {
	e = e || event;
	keysDown[e.keyCode] = e.type == 'keydown';
	// console.log(e.keyCode);

    if (e.keyCode == 82 || e.keyCode == 114) { // 'r' 'R'
    	maintainPosition = true;
  		seekToActiveCaption(true);
    }
	if (!currentlyEditing) {
	    if (e.keyCode == 32) { // space for start/stop
	    	if (player.getPlayerState() == 1) { // 1 is the code for playing
	    		player.pauseVideo();
	    	}
	    	else {
	    		player.playVideo();
	    	}    		
    	}
    }
    else {
    	if (e.keyCode == 13) { // enter 
    		e.preventDefault();
			currentlyEditing.classList.remove("editable"); // repeated because this needs to happen immediately
    		currentlyEditing.blur();
    	}
    	if (e.keyCode == 9) {
    		e.preventDefault();
    		var curIdx = currentlyEditing.id.split("caption")[1];
    		var newIdx;
    		if (keysDown[16]) { // shift
    			newIdx = Math.max(0, parseInt(curIdx) - 1);
    		}
    		else {
    			newIdx = parseInt(curIdx) + 1;
    		}
    		var newCaption = document.getElementById("caption" + newIdx);
    		currentlyEditing.blur();
    		makeCaptionEditable(newCaption);
    	}
    }
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

function loadVideoFormSubmit() {
	var ytLink = document.getElementById("yt-link");
	var ytUrl = ytLink.value;
	if (ytUrl.trim().length == 0) {
		return false;
	}
	ytLink.value = getYoutubeId(ytUrl);
	return true;
}