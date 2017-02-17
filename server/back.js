
var http = require('http');
var ws = require('nodejs-websocket');

var express = require('express');
var app = express();

// web server
var server = 



/*
// websocket server
ws.createServer(function(conn){	
	console.log( '创建websocket服务器' );
	
	conn.on('text', function(str){		
		conn.sendText( str );
	});
	
	conn.on('close', function(code, reason){		
		console.log('连接关闭: ' + code + ", 原因：" + reason);
	});	
	
	conn.on('error', function(code, reason){		
		console.log('连接异常: ' + code + ", 原因：" + reason);
	});	
}).listen( 8066 );
*/


var http = require('http');
var ws = require('nodejs-websocket');

var express = require('express');
var app = express();

var router = require('./router');
var root = __dirname.substr(0, __dirname.lastIndexOf('\\')) + '\\';


start();
// web server
function start(){		
	var server = app.listen( 8000, function(){
		
		var address = server.address()
		var host = address.address
		var port = address.port;
		
		includeStaticFile();
		console.log( '服务器已启动...' );
	});
}


// 静态资源包含
function includeStaticFile(){
	var sFiles = router.staticFile;
	
	//sFiles.forEach(function(item, index){
		app.use( express.static( root ) )
	//});
}


// 路由分配
app.get( '/', function(req, res){	
	var path = req.path;
	var filename = router[path].pathname;
	res.sendFile( root + filename );	
})
