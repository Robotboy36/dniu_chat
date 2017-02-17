

var win = $(window);
var doc = $(document);
var body = $('.dniu-container');
var htmlBody = $('html,body');


/*
 * 全局方法
 * */


/***
* 接口路径配置
*/
$.path = {
	root: '/api.ashx?ac=/api/'
}


/**
 * 工具集
 * */
$.tools = {	

	throttle: function( fn, timespan ){		
		timespan = timespan || 300;
		
		return function( e ){			
			clearTimeout( fn.timekey );	
			
			fn.timekey = setTimeout( function(){
				fn( e );
			}, timespan);			
		};
	},
	
	format: function( str, data ){			
		var matchs = str.match(/{[^}]+?}/g);	
		
		if( matchs === null ){
			return '';
		}
		
		var maLen = matchs.length;
		data = data instanceof Array ? data : [data];	
		
		var html = '';
		for( var n=0, len=data.length; n<len; n++ ){
			var obj = data[n];
			var temp = str;
			
			for( var i=0; i<maLen; i++ ){				
				var match = matchs[i];
				var name = match.replace(/{|}/g, "");
				temp = temp.replace( match, obj[name] || '' );
			}

			html += temp;
		}		
		
		return html;
	},
	
	stopPropa: function(e){
		e = e || window.event;
		e.cancelBubble = true;
		
		if( e.stopPropagation ){
			e.stopPropagation();
		}		
	},

	prevent: function(e){
		e = e || window.event;
		e.preventDefault && e.preventDefault();
	},

	getTarget: function( e ){
		e = e || window.event;
		return $( e.target || e.srcElment );
	},
	
	pos: function( el ){
		
		var x = 0;
		var y = 0;
		
		var pos = {
			width: el.offsetWidth,
			height: el.offsetHeight
		};
		
		while( el.tagName !== "BODY" ){
			x += el.offsetLeft;
			y += el.offsetTop;
			
			el = el.parentNode;
		}
		
		pos.x = x;
		pos.y = y;
		
		return pos;	
	},
	
	
	offset: function( el ){
		
		var pos = {
			x: el.offsetLeft,
			y: el.offsetTop,
			width: el.offsetWidth,
			height: el.offsetHeight
		};
		
		return pos;	
	},


	gotoPos: function( yPos ){
		htmlBody.animate({
			'scrollTop': yPos
		}, 500);
	},


	ajax: function( opt ){
		opt.url = $.path.root + opt.url;
		opt.type = opt.type || "POST";
		opt.dataType = opt.dataType || "json";

		opt.beforeSend = opt.beforeSend || function( xhr ){
			if( !$.tools.loadingWidth ){
				$.tools.showLoading();
			} 
		}

		opt.complete = opt.complete || function(xhr, ts){
			$.tools.hideLoading();
		}

		opt.error = opt.error || function(){
			$.dialog.error("网络请求失败...");
		}

		$.ajax( opt );
	},

	post: function( url, data, fn ){

		if( typeof data === 'function' ){
			fn = data;
			data = {};
		}

		var opt = {
			url: url,
			type: "POST",
			data: data,
			success: fn || function(req){}
		}

		this.ajax( opt );
	},

	get: function( url, data, fn ){

		if( typeof data === 'function' ){
			fn = data;
			data = {};
		}

		var opt = {
			url: url,
			type: "GET",
			data: data,
			success: fn || function(req){}
		}

		this.ajax( opt );
	},
	
	ajaxFile: function( opt ){		
		if( !opt.url ){
			alert('请传入上传地址');
			return;
		}
		
		opt.url = $.path.root + opt.url;
		
		opt.progress = opt.progress || function(evt){			
			if( evt.lengthComputable ){				
				console.log( "上传进度: " + Math.round( evt.loaded * 100 / evt.total ) );
			}			
		}
		
		opt.loadstart = opt.loadstart || function(evt){			
			console.log("开始装载文件...");		
		}		
		
		opt.loadend = opt.loadend || function(evt){			
			console.log("装载完成...");		
		}		
		
		opt.success = opt.success || function(res){			
			$.dialog.success( "上传完成" );
		}
		
		opt.abort = opt.abort || function(evt){		
			$.dialog.error("网络中断");
		}
		
		opt.error = opt.error || function(evt){		
			$.dialog.error("网络错误");
		}
		
		var xhr = new XMLHttpRequest();			
		xhr.open( "POST", opt.url, true );		
		xhr.upload.addEventListener("progress", opt.progress);		
		xhr.upload.addEventListener("loadstart", opt.loadstart);
		xhr.upload.addEventListener("loadend", opt.loadend);		
		xhr.addEventListener("abort", opt.abort);		
		xhr.addEventListener("error", opt.error);		
		xhr.addEventListener("load", function(){
			opt.success( xhr.responseText );
		});
				
		// opt.data 需是 FormData对象
		xhr.send( opt.data )
	},

	//从地址栏获取参数
	locParam: function( name ){
		var param = window.location.search;
		if( param.indexOf("?") == -1 ){
			return "";
		}

		param = param.substr(1);
     	var reg = new RegExp("&{0,1}"+ name +"=([^&]+?)");
     	var value = param.match(reg);

     	if( value ){
     		return value[1]
     	}

		return "";
	},

	getItem: function( name ){
		var value = localStorage.getItem( name );

		if( value == null ){
			value = sessionStorage.getItem( name );
		}

		if( value == null ){
			var reg = new RegExp( ".*" + name + "=(.*);{1}.*" );
			var result = document.cookie.match( reg );
			if( result && result.length > 1 ){
				value = result[1];
			}
		}

		return value;
	},

	setItem: function( name, value ){
		localStorage.setItem( name, value );
	},

	removeItem: function( name ){
		localStorage.removeItem( name );
	},

	///加载相关	
	loadingStyleEl: null,

	loadingWidth: 0,	
	
	initLoad: function(){
		var head = $("head");
		this.loadingWidth = 0;

		if( !this.loadingStyleEl ){
			head.append( '<style id="page_html_loadstyle"></style>' );
		}

		this.loadingStyleEl = $("#page_html_loadstyle")
	},

	loadStyle: function( width, opacity ){

		var styleHtml = 'html::before {'
			styleHtml += 'content: "";'
			styleHtml += 'position: fixed;'
			styleHtml += 'top: 0;'
			styleHtml += 'left: 0;'
			styleHtml += 'width: ' + width + '%;'
			styleHtml += 'opacity: ' + opacity + ';'
			styleHtml += 'height: 2px;'
			styleHtml += 'background: #0076ff;'
			styleHtml += 'z-index: 10;'
			styleHtml += 'box-shadow: 0 0 2px #498699;'
			styleHtml += 'transition: all ease-in-out 0.3s;'
			styleHtml += '-webkit-transition: all ease-in-out 0.3s;'
			styleHtml += '}'
		
		this.loadingStyleEl.html( styleHtml );
	},

	showLoading: function(){
		this.loadingWidth ++;		

		this.showLoading.key = setTimeout(function(){
			this.loadStyle( this.loadingWidth, 1 );			
			this.loadingWidth<85 && this.showLoading();
		}.bind(this), 100);
	},


	hideLoading: function(){
		clearTimeout( this.showLoading.key );
		this.loadStyle( 95, 1 );

		setTimeout(function(){
			this.loadingWidth = 0;
			this.loadStyle( 100, 0 );
		}.bind(this), 100);
	},

	//获取验证码
	getYzm: function(){
		var yzmEl = $(".yzm-code");

		this.get( $.path.yzm, function(res){
			yzmEl.text( res.data );
			yzmEl.val( res.data );
		})
	},
	
	limit: function(min, max){
		return Math.floor( Math.random() * (max- min) + min );
	}
}


/**
 * 弹窗处理
 * */
$.dialog = {
		
	init: function(){
		$("[dialog]").on("click.propa", $.tools.stopPropa);

		//现有窗体事件处理
		body.find("[cancel-btn],[dialog-hide]").on("click", function(e){
			$(this).closest(".dialog").fadeOut(200);
		});		
	},
	
	template: 
		'<div id="{id}" class="dialog-container dialog-{type}" data-important="{important}">'+
			'<div class="dialog-mask-layer"></div>'+
			'<div class="dialog">'+
				'<div class="dialog-header">'+
				'	<h1 class="dialog-title">{title}</h1>'+
				'	<span dialog-hide class="delete_x"></span>'+
				'</div>'+
				'<div class="dialog-body {icontype}">{content}</div>'+
				'<div class="dialog-footer">{footer}</div>'+
			'</div>'+
		'</div>',
	
	
	show: function( opt ){
		
		opt.id = opt.id || "dialog"+(+new Date())		
		opt.important = opt.important || ''
		opt.type = opt.type || "alert"
		opt.title = opt.title || "温馨提示"
		opt.content = opt.content || "哎哟不错"
		opt.height = opt.height || 360
		opt.width = opt.width || 500
		opt.icontype = opt.icontype || "";
		opt.callback = opt.callback || function(){}
		opt.showedFn = opt.showedFn || function(){}
		
		opt.footer = opt.footer || 
			'<button cancel-btn class="btn">取 消</button>'+
			'<button sure-btn class="btn primary">确 认</button>';
					
		var dialogHtml = $.tools.format( this.template, opt );
		var dialog = $(dialogHtml);	

		var dialogContent = dialog.find(".dialog");		
		dialogContent.css({
			height: opt.height,
			width: opt.width
		});
			
		
		/// 确认
		dialog.find("[sure-btn]").on("click.dialog", function(e){
			$.tools.stopPropa(e);
			
			var result = opt.callback && opt.callback();			
			if( result !== false ){ // 如果回调函数return false; 则不关闭窗体
				this.hide(e);
			}						
		}.bind(this));
		
		// 绑定关闭触发
		dialog.find("[cancel-btn],[dialog-hide]").on("click", this.hide.bind(this) );		
		doc.on("click.dialog", this.hide.bind(this) );
				
		
		/* 绑定事件 */		
		dialogContent.on("click", function(e){			
			$.tools.stopPropa(e);
		});
				
		body.append( dialog );		
		setTimeout(function(){
			dialog.addClass("dialog-show");
			opt.showedFn && opt.showedFn();
		}, 10);	
		
		return dialogContent;
	},
	
	
	hide: function( e ){
		$.tools.stopPropa(e);

		var target = $(e.target);
		var container = target.closest(".dialog-container");
		var isImportant = container.attr("data-important");

		//重要窗口点击遮罩层不关闭
		if( isImportant && (target.hasClass("dialog-container") || target.hasClass("dialog-mask-layer"))){
			return;
		}

		var dialog = container.find(".dialog");
				
		dialog.removeClass("dialog-show");
		container.remove();	
	},
	
	success: function(msg, fn){		
		$.dialog.show({
			id: 'dialog114',
			type: "success",
			icontype: "success",
			content: msg,
			width: 400,
			height: 240,
			footer: '<button class="btn" sure-btn>关闭</button>',
			callback: fn
		});
	},	
	
	warm: function(msg, fn){		
		$.dialog.show({
			id: 'dialog110',
			type: "warm",
			icontype: "warm",
			content: msg,
			width: 400,
			height: 240,
			footer: '<button class="btn" sure-btn>关闭</button>',
			callback: fn
		});
	},	
	
	error: function(msg, fn){		
		$.dialog.show({
			id: 'dialog119',
			type: "error",
			icontype: "error",
			content: msg,
			width: 400,
			height: 240,
			footer: '<button class="btn" sure-btn>关闭</button>',
			callback: fn
		});
	}
}


/**
 * 提示框
 * */
$.tip = {
	
	timeKey: 0,
		
	template: '<div class="tip" tip>{msg}</div>',
		
	show: function( msg, time ){		
		msg = msg || '没写提示语';		
		var el = $('[tip]');
				
		//参数设定
		time = typeof time === 'number' ? time : 3000;		
		
		if( el.size() === 0 ){
			el = $( $.tools.format( this.template, {msg: msg}) );	
			body.append( el );
		}else{
			el.html( msg );
		}
		
		//宽度计算
		el.width( msg.length * 20 );				
		el.fadeIn(300);		
		
		clearTimeout( this.timeKey );
		this.timeKey = setTimeout(this.hide, time);
	},
	
	hide: function(){			
		$('.tip').fadeOut( 200, function(){
			$(this).remove();
		});
	}
}


/**
 * 用户相关
 * */
$.user = {
	userKey: 'api_user_name',

	loginPage: 'login.aspx',
	
	init: function(){
		var loginEl = $("[login]");
		var logOutEl = $("[logout]");
		
		loginEl.on("click", this.login.bind(this));
		logOutEl.on("click", this.logout.bind(this));

		var loc = location.href;
		if( loc.indexOf( this.loginPage )>-1 ){
			$.tools.removeItem( this.userKey );
		}

		this.checkLogin();
	},

	
	login: function(){
		var _this = this;

		var param = {
			name: $("#loginUser").val().trim(),
			pass: $("#loginPass").val().trim(),
			code: $("#txtCode").val().trim()
		}

		if( !param.name || !param.pass || !param.code ){
			$.dialog.warm('请填写完整信息');
			return;
		}

		$.tools.ajax({
			url: $.path.user.login,
			data: param,
			success:function(res){
				if( res.code == 0 ){
					//设置
					$.tools.setItem( _this.userKey, JSON.stringify(res.data) );
					window.location.href = 'index.aspx';
				}else{
					$.dialog.error( res.msg );
				}
			}
		});
	},

	checkLogin: function(){
		var _this = this;
		var user = $.tools.getItem( _this.userKey );
		if( user ){
			user = JSON.parse(user);
			_this.setHeadInfo( user );
			return true;
		}

		var isLogin = false;
		$.tools.ajax({
			url: $.path.user.checklogin,
			async: false,
			success:function(res){
				if( res.code == 0 ){					
					//设置
					$.tools.setItem( _this.userKey, JSON.stringify(res.data) );
					_this.setHeadInfo( res.data );
					isLogin = true;
				}
			}
		});

		return isLogin;
	},

	setHeadInfo: function( user ){
		var userEl = $(".user");
		var userHeadEl = $(".user-img");
		var userNameEl = $(".user-name");
		var telEl = $(".user-tel");
		var emailEl = $(".user-email");

		userHeadEl.attr('src', user.uhead);
		userNameEl.text( user.nickname || user.uname );
		telEl.val( user.utel );
		emailEl.val( user.uemail );
		$('.user-nick').val( user.nickname );
	},

	logout: function(){
		var _this = this;
		////
		$.tools.post( $.path.user.logout, function(){
			//清除缓存
			$.tools.removeItem( _this.userKey );
			window.location.href = _this.loginPage;
		});
	}
}


$.tools.initLoad();
$.dialog.init();

