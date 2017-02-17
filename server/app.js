
var http = require('http');
var ws = require('nodejs-websocket');

var express = require('express');
var app = express();

// web server
var server = null;



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
