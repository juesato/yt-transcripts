var express = require('express');
var http = require("http");
var app = express();
var request = require("request");

var api = express();
api.get('/auto_captions/*', function(req, res) {
	// var url = "http://www.dailymail.co.uk/news/article-2297585/Wild-squirrels-pose-charming-pictures-photographer-hides-nuts-miniature-props.html"
	var url = "http://www.youtube.com"
	var ytId = req._parsedUrl.pathname.split('auto_captions/')[1].split('/')[0];
	var ytUrl = "http://www.youtube.com/watch?v=" + ytId;

	request(ytUrl, function(error, res, body) {
		if (error) {
			console.log("Error");
			console.log(error);
		}
		else {
			console.log("Response is ", res.statusCode);
			console.log(body);
		}
	})

	console.log(webpage);

	res.jsonp({
		'ytId': ytId,
		'ytUrl': ytUrl
		// 'contents': webpage
	});
});


app.use('/', express.static('static'));
app.use('/api', api);

var server = app.listen(3000, function() {

	var host = server.address().address;
	var port = server.address().port;

	console.log('Example app listening at http://%s:%s', host, port);
});