var curVideoId = 'OJpQgSZ49tk';
var player;

function onYouTubeIframeAPIReady() {
    player = new YT.Player('player', {
        videoId: curVideoId,
        playerVars: {
            controls: 1,
            autoplay: 1,
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
	return xhr.responseXML.firstChild;
}

var xml = getTranscriptXML("lZ3bPUKo5zc");


var nodes = xml.getElementsByTagName("text");
for (var i = 0; i < nodes.length; i++) {
	var dur = nodes[i].getAttribute("dur");
	var start = nodes[i].getAttribute("start");
	var text = nodes[i].innerHTML;
	// console.log(dur + " " + start + " " + text);
}

