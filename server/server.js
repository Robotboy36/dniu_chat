
var fs = require('fs');
var url = require('url');
var exec = require('child_process').exec

var express = require('express');
var app = express();
var http = require('http').Server(app);
var io = require('socket.io')(http);

var router = require('./router');
var root = __dirname.substr(0, __dirname.lastIndexOf('\\')) + '\\';


// 静态资源包含
function includeStaticFile(){
	var staticFile = router.staticFile;
	staticFile.forEach(function(item){
		app.use('/', express.static( item ) )
	})
}


// 监听请求
app.all('*', function(req, res){	
	var path = req.path;	
	var filename = path;	
	
	if( path === '/' || path === '/index.html' ){
		filename = 'index.html';
	}
	
	if( /.+(\.php|server|\.jsp|\.asp|\.aspx|\.ashx)+.*/.test( path ) ){
		res.sendFile( root + 'error.html' );
		return;
	}
		
	res.sendFile( root + filename, function(err){
		if(err){
			res.sendFile( root + 'error.html' );
		}
	});
});


function getClientIp( req ){
    return req.headers['x-forwarded-for'] ||
    req.connection.remoteAddress ||
    req.socket.remoteAddress ||
    req.connection.socket.remoteAddress;
}



// -------------------------------------------

// 用户信息
var onlineUsers = {}
var onlineUserCount = 0;
var online = 0;

// 游戏用户以及状态
var inGameUsers = [];
var boosUser = null;
var baseMoney = 10;
var ongame = 0;

// 0: 初始状态
// 1：玩家已全部准备
// 2：牌已随机生成
// 3：发牌中
// 4：发牌完毕
// 5：玩家已全部算完点数
// 6：计算输赢金额
var gameStatus = 0
var pukes = []
var pukeType = ['hong','fang','hei','mei'] //扑克类型


// 玩家状态
// 0： 加入游戏, 初始状态
// 1: 准备完毕
// 2：已发完牌
// 3: 已计算完点数
// 4: 与庄家已计算完金额得失


// socket 连接
io.on('connection', function(socket){
	var ip = socket.handshake.address;
		
	socket.emit('open'); //通知客户端已连接	
	var client = {
		ip: ip,		
		money: 100
	}
	
	//接收登录信息
	socket.on('login', function(data){
		data.name = filterHtml(data.name);
		data.headImg = filterHtml( data.headImg );
		client.name = data.name;
		// 发送游戏中的数据
		sendGameUsers('initlogin');

		if( onlineUsers.hasOwnProperty(data.userid) ){   //该用户已登录
			client = onlineUsers[data.userid];
			
			socket.emit('users', {
				type: 'userlist',
				msg: '已登录',
				users: onlineUsers,
				onlineCount: onlineUserCount
			});
			return;
		}
								
		onlineUserCount++;		
		client.loginTime = getTime();
		client.headImg = data.headImg;
		socket.userip = ip;
		socket.userid = data.userid;
		
		//记录到 当前在线用户
		onlineUsers[data.userid] = client;
		
		var param = {
			client: client,			
			type: 'login',
			msg: client.name + '进入演艺圈'
		}
		
		socket.emit('system', param);		
		socket.broadcast.emit('system', param);
				
				
		var usersList = {
			count: onlineUserCount,
			users: onlineUsers
		}
		
		socket.emit('users', usersList);	
		socket.broadcast.emit('users', usersList);
	});
	
	
	//退出登录
	socket.on('disconnect', function(data){		
		if( onlineUsers.hasOwnProperty(socket.userid) ){
			onlineUserCount--;			
			delete onlineUsers[socket.userid];
						
			socket.broadcast.emit('users', {
				count: onlineUserCount,
				users: onlineUsers
			});
			
			socket.broadcast.emit('system', {
				type: 'disconnect',
				msg: client.name + '不堪重负, 已退出演艺圈'
			});

			exitGame();
		}
	})
	
	
	//接收聊天消息
	socket.on('chat', function(data){		
		if( !checkOnline(data) ){
			socket.emit('reload');
			return;
		}

		data.name = filterHtml( client.name );
		data.img = filterHtml( data.img );
//		data.msg = filterHtml( data.msg );
		data.time = getTime();
		
		socket.emit('chat', data);
		socket.broadcast.emit('chat', data);
	});
	
	
	//接收前端发来的系统消息
	socket.on('system', function(data){			
		if( !checkOnline(data) ){
			socket.emit('reload');
			return;
		}

		data.type = "system";
		data.msg = filterHtml( data.msg );
		data.headImg = filterHtml( data.headImg );
		
		socket.emit('system', data);
		socket.broadcast.emit('system', data);
	});	
	
	
	// ====== 游戏相关 =====
	//加入游戏
	socket.on('joingame', function(data){			
		if( !checkOnline(data) ){
			socket.emit('reload');
			return;
		}

		if( checkinGame( data ) ){ // 已加入
			socket.emit('system', {type: 'game', msg: '您已经在游戏中'});
			return;
		}

		if( inGameUsers.length === 8 ){ // 最多8个人
			socket.emit('system', {type: 'game', msg: '游戏已满员, 暂时不能加入'});
			sendGameUsers('overflow');
			return;
		}
		
		// 非初始状态
		if( gameStatus !== 0 ){ 
			socket.emit('system', {type: 'game', msg: '游戏正在进行中'});
			sendGameUsers('gameing');
			return;
		}
		
		if( data.money < 10 ){
			socket.emit('system', {type: 'game', msg: '余额不足'});
			sendGameUsers('nomoney');
			return;
		}
		

		var tempid = limit(1000, 10000)		
		data.joinTime = getTime();
		data.status = 0;
		data.puke = [];
		data.pukeid = 'player_puke_' + tempid;
		data.moneyid = 'player_money_' + tempid;
		data.stepMoney = '';
		data.pukeHtml = '';
		data.result = -1;
		data.resultTxt = '没牛';
		
		data = Object.assign(data, client);
		
		inGameUsers.push( data );
		sendGameUsers('joingame');
	})
	
	
	//玩家准备
	socket.on('readygame', function(data){	
		if( !checkinGame(data) ){
			sendGameUsers('outgame');
			return;
		}

		var len = inGameUsers.length;		
		for( var i=0; i<len; i++ ){
			var user = inGameUsers[i];
			
			if( user.status == 0 && user.userid === data.userid ){				
				if( user.money < 10 ){
					socket.emit('system', {type: 'game', msg: '余额不足'});
					inGameUsers.splice(i, 1);
					sendGameUsers('nomoney');
					return;
				}
				
				user.status = 1;
				user.type = 'ready';
				user.remind = '<i class="ready">(备)</i>'
				setUserGameData( user );
				break;
			}
		}
		
		// 非初始状态
		if( gameStatus !== 0 ){ 
			socket.emit('system', {type: 'game', msg: '游戏正在进行中'});
			sendGameUsers('gameing');
			return;
		}			
		
		// 游戏初始状态
		if( len > 1 && checkUserGameStatus(1) ){
			gameStatus = 1;
			
			randomPuke();		
			setZhuangJia();
			sendPuke();
		}
	})
	
		
	// 发牌完毕
	socket.on('sendover', function(data){	
		if( !checkinGame(data) ){
			sendGameUsers('outgame');
			return;
		}

		data.status = 2;
		data.type = 'sendover';
		setUserGameData( data, 1 );
		
		if( checkUserGameStatus(2) ){ // 用户全部发牌完毕， 游戏进入状态4(发牌完毕)
			gameStatus = 4;
		}
	})
	
		
	// 点数计算完毕
	socket.on('countover', function(data){	
		if( !checkinGame(data) ){
			sendGameUsers('outgame');
			return;
		}

		data.status = 3;
		data.type = 'countover';
		setUserGameData( data );

		var msg = {
			msg: data.name + ' ' + data.resultTxt
		}
		socket.emit('system', msg);
		socket.broadcast.emit('system', msg)
		
		if( gameStatus === 4 && checkUserGameStatus( 3 ) ){// 用户全部计算点数完毕， 游戏进入状态5(计算点数完毕)
			gameStatus = 5;			
			setTimeout(countMoney, 3000);
		}
	})
		
	// 金额计算完毕
	socket.on('moneyover', function(data){	
		if( !checkinGame(data) ){
			sendGameUsers('outgame');
			return;
		}

		data.status = 4;
		data.type = 'moneyover';
		setUserGameData( data, 1 );
		
		if( gameStatus === 5 && checkUserGameStatus( 4 ) ){
			gameStatus = 6;
			
			gameInit();
		}
	})	
	
	
	//退出游戏
	socket.on('exitgame', exitGame)
		
	function exitGame(){	
		var user = null;

		for( var i=0; i<inGameUsers.length; i++ ){
			if( inGameUsers[i].userid === socket.userid ){
				if( gameStatus !== 0 ){ //游戏中退出
					inGameUsers[i].status = -2;
					inGameUsers[i].remind = '<i class="die">(挂)</i>';

					user = inGameUsers[i];
				}else{
					inGameUsers.splice(i, 1);
				}

				break;
			}
		}
		
		sendGameUsers('userexit', user);
	}
	
	// 发送用户信息
	function sendGameUsers( type, user ){		
		gameStatus = inGameUsers.length > 0 ? gameStatus:0;

		var data = {
			type: type || 'normal',
			gameStatus: gameStatus,
			gameUsers: inGameUsers,
			online: online,
			ongame: ongame,
			user: user
		}

		socket.emit('gameusers', data);	
		
		if( type !== 'initlogin' ){
			socket.broadcast.emit('gameusers', data);
		}	
	}
	
	
	/* 游戏初始化 */
	function gameInit(){
		gameStatus = 0;
		
		for( var i=0; i<inGameUsers.length; i++ ){
			var user = inGameUsers[i];		
			if( user.status == -2 ){
				inGameUsers.splice(i, 1);
				continue;
			}


			user.status = 0;
			user.puke = [];
			user.pukeHtml = '';
			user.className = '';
			user.countpanel = '';
			user.stepMoney = '';
			user.result = -1;
			user.resultTxt = '没牛';
		}
		
		// 重新开始
		sendGameUsers( 'gamereinit' );
	}
	
		
	/* 随机生成所用扑克牌 */
	function randomPuke(){
		var sumPuke = inGameUsers.length * 5;
		pukes = []; 
		
		var i = 0;
		while( i < sumPuke ){	
			var type = pukeType[ limit(0, 4) ];
			var value = limit(1, 13);
			
			var txt = getTxt4Val( value );
			var item = {
				type: type,
				text: txt,
				value: value>10 ? 10 : value
			};
			
			if( checkPukeExist(item) ){ 
				continue;
			}
				
			i++;
			pukes.push( item );
		}
				
		gameStatus = 1;		
	}
	
	
	/* 检测生成的扑克牌是否已存在 */
	function checkPukeExist( p ){
		for( var i=0; i<pukes.length; i++ ){
			var puke = pukes[i];
			
			if( puke.type === p.type && puke.text === p.text ){
				return true;
			}
		}
		
		return false;
	}
	
	/* 通过value获取txt */
	function getTxt4Val( value ){
		var txt = 1;
		
		switch( value ){
			case 1: txt = 'A'; break;
			case 11: txt = 'J'; break;
			case 12: txt = 'Q'; break;
			case 13: txt = 'K'; break;
			default: txt = value; break;
		}
		
		return txt;
	}
		
	/* 设定庄家 */
	function setZhuangJia(){
		inGameUsers.forEach(function(item){
			item.isBoos = 0;
			item.remind = '';
		});
		
		var index = limit(0, inGameUsers.length);
		inGameUsers[index].isBoos = 1;		
		inGameUsers[index].remind = '<i class="zhuang">(庄)</i>';	
		boosUser = inGameUsers[index];
		
		sendGameUsers('setBoos');
	}
	
	/* 开始发牌 */
	function sendPuke(){
		var data = {
			pukes: pukes
		}
		
		socket.emit('pukes', data);
		socket.broadcast.emit('pukes', data);
	}
		
	/* 检测用户是否全部在某个状态 */
	function checkUserGameStatus( status ){
		for( var i=0; i<inGameUsers.length; i++ ){
			var user = inGameUsers[i];
			
			if( user.status !== status && user.status != -2 ){
				return false;
			}
		}
		
		return true;
	}
		
	/* 设置用户游戏状态 */
	function setUserGameData( data, noSendUserList ){
		for( var i=0; i<inGameUsers.length; i++ ){
			var user = inGameUsers[i];
			
			if( user.userid === data.userid ){
				inGameUsers[i] = Object.assign(user, data)
			}
		}
		
		if( !noSendUserList ){
			sendGameUsers( data.type );
		}		
	}
	
		
	function countMoney(){		
		var maxUser, 
			minUser, 
			step = 1;
		
		for( var i=0; i<inGameUsers.length; i++ ){
			var user = inGameUsers[i];
			
			if( user.isBoos ){
				continue;	
			}			
			
			// 比较大小
			maxUser = boosUser.result >= user.result ? boosUser : user;
			minUser = boosUser.result < user.result ? boosUser : user;
			
			// 计算是否翻倍
			step = maxUser.result > 7 ? ( maxUser.result==10 ? 3 : 2 ) : 1;
			
			var money = step * baseMoney;

			maxUser.money += money;
			maxUser.stepMoney = '+' + money;

			minUser.money -= money;
			minUser.stepMoney = '-' + money;
		}
		
		// 发送数据到前端
		sendGameUsers( 'moneyover' );
	}	


	// 检测是否在用户列表
	function checkOnline( data ){
		if( onlineUsers[data.userid] ){
			online = 1;
			return true;
		}

		online = 0;
		return false;
	}

	// 检测是否在还在游戏用户中
	function checkinGame( data ){
		for( var i=0; i<inGameUsers.length; i++ ){
			if( inGameUsers[i].userid === data.userid ){
				ongame = 1;
				return true;
			}
		}

		ongame = 0;
		return false;
	}
});



 
http.listen(80, function(){
	exec('clear');
    console.log(getTime() + ' start at 8000');
    includeStaticFile();
});
 
 
function getTime(){
  var d = new Date();
  return fill(d.getHours()) + ":" + fill(d.getMinutes()) + ":" + fill(d.getSeconds());
}


function fill( n ){
	return n>9 ? n : '0'+n;
}
 
function getColor(){
  var colors = ['aliceblue','antiquewhite','aqua','aquamarine','pink','red','green',
                'orange','blue','blueviolet','brown','burlywood','cadetblue'];
  return colors[Math.round(Math.random() * 10000 % colors.length)];
}

function limit( min, max ){
	return Math.floor( Math.random()*(max-min) + min );
}


function filterHtml( msg ){
	
	if( !msg ){
		return;
	}
	
	msg = msg.replace('script', '');
	msg = msg.replace('http', '');	
	msg = msg.replace('https', '');			
	msg = msg.replace('//', '');		
	msg = msg.replace('href', '');		
	msg = msg.replace('src', '');		
	msg = msg.replace('link', '');		
	msg = msg.replace('location', '');		
	msg = msg.replace('.js', '');
	msg = msg.replace('.html', '');	
	msg = msg.replace('.aspx', '');	
	msg = msg.replace('.asp', '');
	msg = msg.replace('.jsp', '');		
	msg = msg.replace('.action', '');
	msg = msg.replace('.do', '');		
	msg = msg.replace('.css', '');						
	
	return msg
}
