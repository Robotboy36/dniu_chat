


var Dniu = {
	
	// -1: 初始状态
	// 0：玩家准备就绪
	// 1：牌已随机生成
	// 2：发牌中
	// 3：发牌完毕
	// 4：玩家已全部算完点数
	// 5：计算输赢金额
	gameStatus: -1,
	
	type: ['hong','fang','hei','mei'],  //扑克类型
	
	player: [],  // 玩家
	
	boosIndex: 0,

	gameStatus: 0,
	
	playerTemp:  // 玩家模板
		'<div id="p{userid}" class="player{className}" style="left: {left}px; top: {top}px">' +
		'	<div class="player-info">' +
		'		<img src="{headImg}" alt="{playerTitle}" title="{name}" />' +
		'		<div>{name}{remind}<p id="{moneyid}" data-money="{stepMoney}">{money}</p></div>' +		
		'		{countpanel}' +
		'	</div>' +
		'	<div class="player-pai" id="{pukeid}">{pukeHtml}</div>' +
		'	<div class="result">{resultTxt}</div>' +
		'</div>',
		
	playerSize: 0, // 游戏人数
	
	playerOffset: {  //玩家模块大小
		width: 140,
		height: 120
	},
		
	chatBoxEl: null,
	
	faceEl: null,
	
	dialogEl: null,
		
	
	tableEl: null,  // 游戏桌子
	
	pukeTempEl: null,  //桌子中间的扑克， 用来克隆发牌用
		
	playersEl: null, //玩家容器
	
	curPlayerEl: null,  //当前玩家元素
	
	clockEl: null,
	
	joinEl: null, // 加入游戏
	
	readyEl: null, // 准备
	
	exitEl: null, // 闪人
	
	timeDown: 20,  //倒计时时间
	
	pukeTemp:     // 扑克模板
		'<div class="puke-item normal {type}" data-value="{value}"><i class="name">{text}</i><i class="name name-rotate">{text}</i><span class="background"></span></div>',
	
	//扑克集
	puke: [],
	
	//当前玩家
	curPlayer: null,
	
	tempSelect: [],
		
	
	/* 游戏初始化 */
	init: function(){		
		this.tableEl = $('.table');
		this.pukeTempEl = this.tableEl.find('.puke-item');
		this.clockEl = this.tableEl.children('.clock');
		this.chatBoxEl = $('.chat-input-box');
		this.faceEl = $('.face-item');
		this.dialogEl = $('#dialog_name');
		
		this.joinEl = $('.join-btn');
		this.readyEl = $('.ready-btn');
		this.exitEl = $('.exit-btn');
		
		this.playersEl = $('.players');
		
		//连接服务器
		this.connectionServer();
	},
	
	connectionServer: function(){			
		if( !Socket.isConnected ){
			console.log('尝试连接服务器...');
			setTimeout( this.connectionServer.bind(this), 1000 );
			return;
		}		
		
		$('.loading').remove();		
		this.getName();
		
		this.initFace();
		this.initEvent();	
	},
	
	
	/* 获取名称 */
	getName: function(){		
		var client = $.tools.getItem('chat_name');
		
		if( !this.curPlayer && client ){		
			this.curPlayer = JSON.parse( client );		
		}
		
		if( !this.curPlayer || !this.curPlayer.userid ){
			this.dialogEl.addClass('dialog-show');
			return;
		}
		
		var data = {
			userid: this.curPlayer.userid,
			name: this.curPlayer.name,
			headImg: this.curPlayer.headImg
		}
					
		this.dialogEl.remove();	
		Socket.ws.emit('login', data);		
	},
	
	
	/* 初始化玩家信息 */
	initPlayer: function(){		
		this.setPlayerPos();
						
		//格式化玩家html
		html = $.tools.format( this.playerTemp, this.player )			
		this.playersEl.html( html );		
//		this.gameStatus = 0;
		
		this.curPlayerEl = this.playersEl.find('.cur-player');
		this.tempSelect = [];
	},
	
	
	/* 初始化玩家显示位置 */
	setPlayerPos: function(){
		//table相关
		var wRadius = Math.ceil( this.tableEl.width() / 2 )
		var hRadius = Math.ceil( this.tableEl.height() / 2 )
		var tPos = $.tools.pos( this.tableEl[0] ) 
		
		// 中心坐标， center bottom
		var tCenter = {	
			x: wRadius,
			y: hRadius
		}			
			
		//玩家相关
		var pOffset = this.playerOffset;
		var pRadius = Math.sqrt( pOffset.width*pOffset.width + pOffset.height*pOffset.height ) / 2;
		pRadius = Math.ceil( pRadius );
		
		// 多边形每个角的角度
		var angle = 180 * (this.playerSize - 2) / this.playerSize;
		var stepAngle = 180 - angle;
		var initAngle = 90 - angle/2;
		
		//当前玩家
		if( this.filterCur() ){
			var cur = this.player[0];	
			cur.className = " cur-player";
			cur.countpanel = 
				'		<div class="value-box">' +
				'			<input readonly />' +	
				'			<input readonly />' +	
				'			<input readonly />' +					
				'			<button class="btn has-niu">有牛</button>' +	
				'			<button class="btn no-niu">没牛</button>' +	
				'		</div>';
				
			this.curPlayer = cur;				
		}
		
		// 计算其他玩家坐标
		var flag = -1;
		for( var i=0, len=this.player.length; i<len; i++ ){
			var player = this.player[i];			
			
			flag = -flag;
			var size = {
				w: Math.cos( this.angle2radian( initAngle + angle/2 + stepAngle*i ) ) * wRadius,
				h: Math.sin( this.angle2radian( initAngle + angle/2 + stepAngle*i ) ) * hRadius
			}
			
			player.left = Math.floor( tCenter.x + size.w - pOffset.width/4 );
			player.top = Math.floor( tCenter.y + size.h - pOffset.height/4 );
		}
	},
		
	
	/* 找出当前玩家, 将当前玩家放在第一个 */
	filterCur: function(){
		var cur = null;
		
		for( var i=0, len=this.player.length; i<len; i++ ){
			var player = this.player[i];
			
			if( player.userid === this.curPlayer.userid ){
				cur = this.player.splice( i, 1 );
				break;
			}
		}
		
		if( cur ){
			this.player.unshift(cur[0]);
			return true;
		}
		
		return false
	},
	
	
	/* 事件处理 */
	initEvent: function(){		
		var _this = this;	

		$(document).on('keydown', function(e){
			if( _this.gameStatus !== 0 && e.keyCode === 116 ){
				e.preventDefault();
				return false;
			}
		});

		// 加入游戏
		_this.joinEl.on('click', function(){						
			$(this).addClass('hide');
			_this.readyEl.add(_this.exitEl).removeClass('hide');
			
			var data = {
				userid: _this.curPlayer.userid,
				name: _this.curPlayer.name,
				headImg: _this.curPlayer.headImg
			}
			
			Socket.joinGame( data );
		});
		
		// 退出游戏
		_this.exitEl.on('click', function(){					
			_this.joinEl.removeClass('hide');
			_this.readyEl.add(_this.exitEl).addClass('hide');
			_this.pukeTempEl.hide(0);
			
			var data = {
				userid: _this.curPlayer.userid,
				name: _this.curPlayer.name,
				headImg: _this.curPlayer.headImg
			}
			Socket.exitGame(data);
		});
		
		// 准备
		_this.readyEl.on('click', function(){	
			_this.readyEl.add(_this.exitEl).addClass('hide');	
			_this.pukeTempEl.show(0);
			
			var data = {
				userid: _this.curPlayer.userid,
				name: _this.curPlayer.name,
				headImg: _this.curPlayer.headImg
			}
			Socket.readyGame(data);
		});
		
		
		this.playersEl.on("click", ".cur-player .puke-item", function(){
			_this.fangpaiFn( this );
		});
		
		this.playersEl.on("click", '.has-niu', this.onHasNiu.bind(this));
		this.playersEl.on("click", '.no-niu', this.onNoNiu.bind(this));
				
		
		//聊天相关
		this.chatBoxEl.children('button').click(this.sendChat.bind(this));	
		var chatInputEl = this.chatBoxEl.children('.chat-input');			
		chatInputEl.on('keydown', function(e){
			if(e.keyCode === 13){			
				e.preventDefault();
				_this.sendChat.call(_this)
			}
		});
		
		//姓名
		this.dialogEl.on('click', '.btn', function(e){
			var name = _this.dialogEl.find('#uname').val().trim();
			
			if( !name ){
				alert('请输入姓名');
				return;
			}
					
			//头像
			var head = Math.floor( Math.random()*(149-122) + 122);
			_this.headImg = 'img/face/' + head + '.gif';	
		
			var client = {
				userid: _this.getId(),
				name: name, 
				headImg: _this.headImg 
			}
			
			$.tools.setItem('chat_name', JSON.stringify(client));
		
			_this.curPlayer = client;		
			Socket.ws.emit('login', client);
			
			_this.dialogEl.removeClass('dialog-show');		
			setTimeout(function(){
				_this.dialogEl.remove();
			},300);
		});
		
		//表情点击
		this.faceEl.on('click', 'i', function(e){
			e.stopPropagation();
			var facePanel = $(this).next();
			facePanel.show(0);
			
			doc.one('click', function(){
				facePanel.hide(0);
			});
		});
		
		this.faceEl.on('click', 'img', function(e){
			var img = $(this).clone();
			_this.chatBoxEl.children('.chat-input').append( img );
		});
		
		
		//通知开关		
		var switchEl = $('.switch');	
		switchEl.on('click', function(e){
			var _this = $(this);
			
			if(_this.hasClass('switch-open')){
				_this.removeClass('switch-open');
				Socket.onNotification = 0;				
			}else{
				_this.addClass('switch-open')
				Socket.onNotification = 1;
			}
			
			$.tools.setItem('on_notification', Socket.onNotification);
		});
		
		var isno = $.tools.getItem('on_notification') - 0;		
		switchEl.addClass( isno ? 'switch-open':'' );
		Socket.onNotification = isno;		
	},
	
	
	/* 初始化表情 */
	initFace: function(){
		var html = '';
		
		for(var i=0; i<122; i++){
			var name = i < 100 ? (i<10 ? '00'+i : '0'+i) : i;
			html += '<li><img src="img/face/' + name + '.gif" /></li>'
		}
		
		this.faceEl.children('.face-item-panel').html( html );
	},
	
	
	sendChat: function(){
		var inputEl = this.chatBoxEl.children('.chat-input');
		var txt = inputEl.html().trim();
		var remindEl = this.chatBoxEl.find('.remind');
				
		if( !this.curPlayer ){
			return;
		}
		
		if( txt === '' ){
			remindEl.stop().fadeIn();
			setTimeout(function(){
				remindEl.fadeOut();
			}, 3000);
			return;
		}
		
		if( txt.length > 100 ){
			txt = txt.substr(0, 100);
		}
		
		inputEl.html('');	
		var data = {
			userid: this.curPlayer.userid,
			name: this.curPlayer.name,
			msg: txt,
			headImg: this.curPlayer.headImg
		}
		
		Socket.sendChat( data );		
	},
	
	
	findBoos: function(){		
		for( var i=0, len=this.player.length; i<len; i++ ){					
			if( this.player[i].isBoos == 1 ){
				this.boosIndex = i;
				break;
			}
		}
	},
	
	
	tempPukeIndex: 0,
	
	/* 发牌 */
	sendPuke: function( index ){		
		var players = this.player;
		var count = players.length;
		var sumPuke = count * 5;
		var _this = this;
				
		Socket.sendSystem( '发牌中' );
				
		if( this.tempPukeIndex == sumPuke ){	 //发牌完毕
			this.tempPukeIndex = 0;
			this.pukeTempEl.hide(0);
			this.clockEl.show(0);
			this.sortPuke();
			Socket.sendSystem( '发牌完毕' );
			
//			this.gameStatus = 3;			
			this.runTime( this.timeDown );
			Socket.sendOver({
				userid: this.curPlayer.userid,
				name: this.curPlayer.name
			});			
			return;
		}
		
		var n = index % count;		
		var player = players[ n ];	
		player.puke.push( this.puke[ this.tempPukeIndex ] );
		
		//发牌动画
		var tempPai = this.pukeTempEl.clone();
		this.tableEl.append( tempPai );
		
		tempPai.animate({
			left: player.left,
			top: player.top
		}, 200, function(){
			$(this).remove();
			
			// 格式化玩家扑克html
			player.pukeHtml = $.tools.format( _this.pukeTemp, player.puke );
			$('#'+player.pukeid).html( player.pukeHtml )	
						
			setTimeout(function(){
				_this.tempPukeIndex ++;
				_this.sendPuke( ++index );
			}, 100)
		});	
	},
	
	
	/* 将牌从大到小进行排序 */
	sortPuke: function(){
		var puke = this.curPlayer.puke;
		puke.sort(function(a, b){
			return b.value - a.value
		});
		
		this.curPlayer.pukeHtml = $.tools.format( this.pukeTemp, puke );
		$('#'+this.curPlayer.pukeid).html( this.curPlayer.pukeHtml )	
	},
	
	
	/* 翻牌, 选牌 */
	fangpaiFn: function( target ){		
		var target = $(target);
		
		if( target.hasClass("normal") ){
			target.removeClass("normal");
			return;
		}
				
		if( target.hasClass("selected") ){
			target.removeClass("selected");
			this.onSelected();
			return;
		}
		
		if( this.tempSelect.length === 3 ){
			return;
		}
		
		target.addClass("selected");
		this.onSelected();
	},
	
	
	/* 选中牌 */
	onSelected: function(){
		var inputs = this.curPlayerEl.find('.value-box input');
		var tempSelect = [];		
		var selected = this.curPlayerEl.find('.puke-item').filter('.selected');			
		
		inputs.val('');		
		for( var i=0; i<selected.size(); i++ ){
			var value = selected.eq(i).attr('data-value');
			
			inputs.eq(i).val( value );
			tempSelect.push( value );
		}
		
		this.tempSelect = tempSelect;
	},
	
	
	/* 有牛 */
	onHasNiu: function(){
		var sum = 0;
		
		if( !this.checkFangpDone() ){
			return;
		}
		
		if( this.tempSelect.length < 3 ){
			$.tip.show('请选择三张牌');
			return;
		}
		
		for( var i=0; i<this.tempSelect.length; i++ ){
			sum += this.tempSelect[i] - 0;
		}
		
		if( sum % 10 === 0 ){ //有牛
			var other = this.curPlayerEl.find('.puke-item:not(.selected)');
			var niu = other.eq(0).attr('data-value') - 0;
			niu += other.eq(1).attr('data-value') - 0;
						
			this.countNiu( niu );
		}else{
			$.tip.show('三个选择的牌之和需为整10数');
		}
	},
	
	
	onNoNiu: function(){		
		if( !this.checkFangpDone() ){
			return;
		}
		
		if( this.autoCheckDian() ){
			$.tip.show('有牛哦, 请再看看');
			return;
		}
	},
	
	
	/* 检测是否翻牌完毕 */
	checkFangpDone: function(){			
//		if( this.gameStatus <= 2 ){
//			return false;
//		}
		
		var normal = this.curPlayerEl.find('.puke-item').filter('.normal');		
		if( normal.size() > 0 ){
			$.tip.show('请翻牌');
			return false;
		}
		
		return true;
	},
	
	
	/* 自动判断点数 */
	autoCheckDian: function(){		
		var arr = this.curPlayer.puke.concat([]);
		var flag = 0;

		if( arr.length < 5 ){
			return 0;
		}
		
		start:
		for( var i=0; i<3; i++ ){
			for( var j=i+1; j<4; j++ ){
				for( var n=j+1; n<5; n++ ){
					var value = arr[i].value + arr[j].value + arr[n].value;
					
					if( value % 10 === 0 ){
						arr.splice(n,1);
						arr.splice(j,1);
						arr.splice(i,1);
						
						flag = 1;
						break start;
					}
				}
			}	
		}
		
		var niu = flag ? arr[0].value + arr[1].value : 0;		
		return niu;
	},
	
	
	/* 计算点数 */
	countNiu: function( niu ){
		var txt = '没牛';
		var result = 0;
		
		if( niu != 0 && niu % 10 === 0 ){
			txt = '牛牛';
			result = 10;
		}else if( niu % 10 !== 0 ){
			result = niu % 10;
			txt = '牛' + result;
		}
		
		this.curPlayer.resultTxt = txt;	
		this.curPlayer.result = result;		
		var cls = result == 0 ? 'no' : 'yes';
		
		clearTimeout( this.countDownKey );
		this.clockEl.hide(0);
		
		var data = {
			userid: this.curPlayer.userid,
			name: this.curPlayer.name,
			result: result,
			resultTxt: txt,
			headImg: this.curPlayer.headImg
		}
		
		Socket.countOver( data );
		Socket.sendSystem( data.name + '-' + txt );
	},
	
	
	// 显示结果
	showResult: function(){		
		for( var i=0, len=this.player.length; i<len; i++ ){	
			var player = this.player[i];
			if( player.status === 3 ){
				var cls = player.result == 0 ? 'no' : 'yes';
		
				$('#'+player.pukeid).find('.puke-item').removeClass('normal');		
				$('#'+player.pukeid).next('.result').html( player.resultTxt ).addClass( cls );
			}
		}
	},
	
	
	initMoney: function(){
		var _this = this;
		for( var i=0, len=this.player.length; i<len; i++ ){	
			var player = this.player[i],
				moneyEl = $('#'+player.moneyid);
			
			var cla = player.stepMoney-0 > 0 ? 'add': 'odd';

			moneyEl.html( player.money );
			moneyEl.append('<i class="stepMoney '+cla+'">'+ player.stepMoney +'</i>');
		}
		
		setTimeout(function(){
			$('.stepMoney').remove();

			Socket.moneyOver({
				userid: _this.curPlayer.userid
			});
		}, 2000);
	},
	
	
	countDownKey: 0,
	
	/* 时钟控制 */
	runTime: function( time ){
		var _this = this;			
		this.clockEl.html( time );
		
		if( time !== 0 ){
			_this.countDownKey = setTimeout(function(){
				_this.runTime( --time );
			}, 1000 );
			
			return;
		}
		
		//超时， 自动判断点数
		this.clockEl.html( this.timeDown ).hide(0);
		
		// if( this.curPlayer.status == 2 ){
		var niu = this.autoCheckDian();		
		this.countNiu( niu );
		// }		
	},
	
	
	//--------------- 公共方法 ----------------
	
	/* 通过value获取txt */
	getTxt4Val: function( value ){
		var txt = 1;
		
		switch( value ){
			case 1: txt = 'A'; break;
			case 11: txt = 'J'; break;
			case 12: txt = 'Q'; break;
			case 13: txt = 'K'; break;
			default: txt = value; break;
		}
		
		return txt;
	},
	
	
	/* 角度转弧度 */
	angle2radian: function( angle ){
		return Math.PI / 180 * angle;
	},
	
	
	/* 判断坐标所在现象 */
	checkRange: function( origin, pos ){
		pos.x = pos.x > origin.x ? pos.x : -pos.x;
		pos.y = pos.y < origin.y ? -pos.y : pos.y; 
	},
	
	
	getId: function(){
		return Math.random().toString().substr(2, 12);
	} 
}

Dniu.init();
