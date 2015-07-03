var express = require('express');
var http = require("http");
var app = express();
var request = require("request");
var parseXml = require('xml2js').parseString;

var api = express();
api.get('/auto_captions/*', function(req, res) {
	// var url = "http://www.dailymail.co.uk/news/article-2297585/Wild-squirrels-pose-charming-pictures-photographer-hides-nuts-miniature-props.html"
	var url = "http://www.youtube.com"
	var ytId = req._parsedUrl.pathname.split('auto_captions/')[1].split('/')[0];
	var ytUrl = "http://www.youtube.com/watch?v=" + ytId;

	request(ytUrl, function(error, response, body) {
		if (!error && response.statusCode == 200) {
			var re = /;ytplayer.config = ({.*?});/;
			var mobj = body.match(re);
			if (!mobj) {
				console.log("Couldn't find automatic captions");
				return;
			}
			var player_config = JSON.parse(mobj[1]);

            var args = player_config['args'],
            	caption_url = args['ttsurl'],
            	timestamp = args['timestamp'];

            // We get the available subtitles
            var list_params = urlEncode({
                'type': 'list',
                'tlangs': 1,
                'asrs': 1,
            })
            var list_url = caption_url + '&' + list_params;
            console.log(list_url);

            var params = urlEncode({
            	'lang': 'en',
            	'tlang': 'en',
            	'fmt': 'srv1',
            	'ts': timestamp,
            	'kind': "asr" // this might be wrong
            });

            request(caption_url + '&' + params, function(error, response, body) {
            	console.log(caption_url + '&' + params);
            	if (!error && response.statusCode == 200) {
            		console.log(body);
		            var transcript = getXml(body);
		            res.jsonp(transcript);
            	}
            });


            // caption_list = self._download_xml(list_url, video_id)
            // original_lang_node = caption_list.find('track')

            // if original_lang_node is None:
            //     self._downloader.report_warning('Video doesn\'t have automatic captions')
            //     return {}
            // original_lang = original_lang_node.attrib['lang_code']
            // caption_kind = original_lang_node.attrib.get('kind', '')

            // sub_lang_list = {}
            // for lang_node in caption_list.findall('target'):
            //     sub_lang = lang_node.attrib['lang_code']
            //     sub_formats = []
            //     for ext in ['sbv', 'vtt', 'srt']:
            //         params = compat_urllib_parse.urlencode({
            //             'lang': original_lang,
            //             'tlang': sub_lang,
            //             'fmt': ext,
            //             'ts': timestamp,
            //             'kind': caption_kind,
            //         })
            //         sub_formats.append({
            //             'url': caption_url + '&' + params,
            //             'ext': ext,
            //         })
            //     sub_lang_list[sub_lang] = sub_formats
            // return sub_lang_list
		}
	});

	// res.jsonp({
	// 	'ytId': ytId,
	// 	'ytUrl': ytUrl
	// });
});

app.use('/', express.static('static'));
app.use('/api', api);

var server = app.listen(3000, function() {

	var host = server.address().address;
	var port = server.address().port;

	console.log('Example app listening at http://%s:%s', host, port);
});

function urlEncode(obj) {
  var str = [];
  for(var p in obj)
    if (obj.hasOwnProperty(p)) {
      str.push(encodeURIComponent(p) + "=" + encodeURIComponent(obj[p]));
    }
  return str.join("&");
}

function getPageContents(url) {
	// same weird scoping deal
	var contents;
	console.log("getPageContentsBeg for ", url);
	request.get(url, function(error, res, body) {
		console.log("beginRequest");
		if (error) {
			console.log("Error");
			console.log(error);
			contents = null;
			// return null;
		}
		else {
			console.log("LOOOK FOR ME\n\n\n\n\n");
			console.log("Response is ", res.statusCode);
			contents = body;
			console.log(contents);
			console.log("SPACE");
			// return body;
		}
	});
	console.log(request.statusCode);
	console.log("endPg");
	return contents;
}

function getXml(str) {
	// I hope that the scoping on this doesn't behave strangely
	var xml;
	parseXml(str, function(err, result) {
		xml = result;
	});
	return xml;
}

var url = "https://www.youtube.com/api/timedtext?v=gF51doydNxs&asr_langs=it%2Cru%2Ces%2Cfr%2Cko%2Cde%2Cpt%2Cja%2Cnl%2Cen&key=yttt1&expire=1435971001&signature=BF55883944DE63B22E956A1E5A7D02CF0B145507.6E86BCEB9EF6A27E5B85D158285A95E3050B2771&hl=en_US&caps=asr&sparams=asr_langs%2Ccaps%2Cv%2Cexpire&type=list&tlangs=1&asrs=1";
// console.log(getPageContents(url));
// console.log(getPageContents("http://www.youtube.com"));