

var Socket = {
	
	server: 'ws://' + location.hostname,
	
	port: 80,
	
	isConnected: false,
	
	ws: null,
	
	onNotification: 1,  //默认开启通知
	
	contentEl: null,
			
	chatTemp: 
		'<div class="chat">' +
			'<img src="{headImg}" />' +
			'<div class="info">' +
				'<div><span class="name">{name}</span>' +
				'<time>{time}</time></div>' +
				'<p>{msg}</p>' +
			'</div>' +
		'</div>',
		
	chatSelfTemp: 
		'<div class="chat self">' +
			'<div class="info">' +
				'<div><span class="name">{name}</span>' +
				'<time>{time}</time></div>' +
				'<p>{msg}</p>' +
			'</div>' +
			'<img src="{headImg}" />' +
		'</div>',
		
		
	
	init: function(){
		this.connection();	
		
		this.contentEl = $('.chat-content');		
		
		//事件处理
		this.ws.on('open', this.onOpen.bind(this))
		this.ws.on('close', this.onClose.bind(this))
		this.ws.on('error', this.onError.bind(this))
		this.ws.on('chat', this.onChat.bind(this))	
		this.ws.on('system', this.onSystem.bind(this))	
		this.ws.on('users', this.onUsers.bind(this))	
		this.ws.on('reload', this.onReload.bind(this))	
		
		// 游戏相关
		this.ws.on('pukes', this.onPukes.bind(this));
		this.ws.on('gameusers', this.onGameUsers.bind(this));
		this.ws.on('moneyover', this.onMoneyOver.bind(this));
		this.ws.on('gameover', this.onGameOver.bind(this));
	},
	
	connection: function(){
		var url = this.server + ':' + this.port;
		this.ws = io.connect( url );
	},
	
	onOpen: function(e){
		console.log( '已连上服务器' );
		this.isConnected = true;
	},
	
	onError: function(e){
		this.isConnected = false;
		this.ws.emit("disconnect");
		console.error( '连接错误: ' + JSON.stringify(e) );
	},
	
	onClose: function(){
		this.isConnected = false;
		this.ws.emit("disconnect");
		console.log( '已断开连接' );
	},
	
	close: function(){
		this.ws.close();
	},
	
	onChat: function(data){		
		var temp = data.userid === Dniu.curPlayer.userid ? this.chatSelfTemp : this.chatTemp;		
		var msg = $.tools.format(temp, data);	
		var child = this.contentEl.children().size();	
		
		if( child > 50 ){
			this.contentEl.children(':eq(0)').remove();
		}
		
		this.contentEl.append( msg );
		
		document.title = data.msg;
		this.contentEl.scrollTop( this.contentEl[0].scrollHeight );
		
		//是否推送消息
		if( this.onNotification ){
			this.sendNotification( data );
		}
	},	
	
	// 获取用户
	onUsers: function(data){		
		//在线用户
		var users = data.users;
		if( users ){
			var userItemTemp = 
				'<div class="user-item">' +
				'	<img src="{headImg}" />' +
				'	<span title="{name}">{name}</span>' +
				'</div>';
			
			var html = '';			
			var len = 0;
			for(var name in users){
				len++;
				var user = users[name];
				html += $.tools.format( userItemTemp, user);
			}
			
			var usersEl = $("#online_users");
			usersEl.children('header').text('在线：'+len+'人');
			usersEl.children('.users-list').html( html );
		}
	},
	
	
	// 系统消息
	onSystem: function( data ){
		if( data.type === 'nameExist' ){
			$.dialog.error('用户名已被占用');
			
			Dniu.curPlayer = null;
			$.tools.removeItem('chat_name');
			Dniu.getName();
			return;
		}
		
		if( data.type === 'usererror' ){
			Dniu.curPlayer = null;
			$.tools.removeItem('chat_name');
			Dniu.getName();
			return;
		}
		
		if( data.type === 'game' ){
			alert( data.msg );
			return;
		}
		
		//系统消息
//		var msg = $.tools.format('<div class="system-msg">{msg}</div>', data);
//		this.contentEl.append( msg );		
//		this.contentEl.scrollTop( this.contentEl[0].scrollHeight );
		document.title = data.msg;
	},

	onReload: function(){
		window.location.reload();
	},
	
	sendSystem: function( msg ){	
		this.ws.emit('system', {
			userid:Dniu.curPlayer.userid,
			msg: msg
		});	
	},
	
	sendChat: function( data ){	
		if( !Dniu.curPlayer ){
			$.dialog.error('请先登录');
			return;
		}

		data.userid = Dniu.curPlayer.userid;		
		this.ws.emit('chat', data );	
	},
	
	
	inGameCount: 0,
	
	joinGame: function( user ){
		if( this.inGameCount == 8 ){
			alert( '游戏最多8人玩，目前已满员' );
			return false;
		}
		
		this.ws.emit('joingame', user );
	},	
	
	readyGame: function( user ){		
		this.ws.emit('readygame', user );
	},
	
	exitGame: function( user ){
		this.ws.emit('exitgame', user );
	},
		
	onGameUsers: function( data ){	
		Dniu.gameStatus = data.gameStatus;

		var users = data.gameUsers;
		Dniu.player = users;
		Dniu.playerSize = users.length;		
		this.inGameCount = users.length;
	
		if( !data.ongame 	// 当前用户不在游戏中
			&& data.type !== 'joingame' 
			&& data.type !== 'ready'
			&& data.type !== 'exitgame'
			&& data.type !== 'userexit' ){	

			this.initGameView();
			Dniu.initPlayer();	
			return;
		}
				
		if( data.type === 'gamereinit' ){
			this.initGameView(1);
			Dniu.initPlayer();	
			return;
		}		
		
		// 点数全部计算完毕
		if( data.type === 'countover' ){
			Dniu.showResult();
			return;
		}
		
		// 金额全部计算完毕
		if( data.type === 'moneyover' ){
			Dniu.initMoney();
			return;
		}		


		// 游戏状态
		if( data.gameStatus !== 0 ){
			Dniu.joinEl.hide(0);

			if( data.type ==='initlogin' ){
				$('.game-tip').show(0);
			}			

			if( data.type === 'userexit' && data.user ){
				$('#p'+data.user.userid).css('color', '#f00');
				return;
			}
		}else{ // 非游戏状态
			$('.game-tip').hide(0);
		}
		
		Dniu.initPlayer();	
	},
	
	sendOver: function(data){
		this.ws.emit('sendover', data );
	},
	
	// 点数计算完毕
	countOver: function( data ){
		this.ws.emit('countover', data );
	},	
	
	// 金额计算完毕
	moneyOver: function( data ){
		this.ws.emit('moneyover', data );
	},
	
	
	onPukes: function( data ){
		Dniu.puke = data.pukes;		
		Dniu.findBoos();
		Dniu.sendPuke(Dniu.boosIndex);		
	},
	
	// 服务端计算金额完毕
	onMoneyOver: function(){
	},

	onGameOver: function(){

	},

	initGameView: function( isReload ){
		clearTimeout( Dniu.countDownKey );
		Dniu.clockEl.hide(0);
		Dniu.pukeTempEl.hide(0);
		Dniu.readyEl.add(Dniu.exitEl).addClass('hide');	
		Dniu.joinEl.removeClass('hide');
		
		$('.game-tip').hide(0);	

		if( isReload ){
			Dniu.readyEl.add(Dniu.exitEl).removeClass('hide');
			Dniu.joinEl.addClass('hide');	
		}
	},
	
	
	/* 通知相关 */
	notif: null,
	
	notificationId: 0,
	
	sendNotification: function( data ){
		var _this = this;
		
		//浏览器是否支持
		if( !window.Notification ){
			return;
		}
		
		//用户是否允许
		if( Notification.permission != 'granted' ){
			Notification.requestPermission();
			return;
		}
		
		
		if( _this.notif ){
			_this.notif.close();
		}
		
		_this.notif = new Notification(data.name, {
			body: data.msg,
			icon: data.headImg,
			tag: _this.notificationId++
		});
						
		_this.notif.onclose = function(e){
			//console.log('关闭'+e);
		}
		
		_this.notif.onclick = function(){
			this.close();
		}
	}
}


Socket.init();

