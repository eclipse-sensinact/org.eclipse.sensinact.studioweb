/*
 * Copyright (c) 2017 CEA.
 * All rights reserved. This program and the accompanying materials
 * are made available under the terms of the Eclipse Public License v1.0
 * which accompanies this distribution, and is available at
 * http://www.eclipse.org/legal/epl-v10.html
 *
 * Contributors:
 *    CEA - initial API and implementation
 */
var Transmitter = (function(gw, url){
	
	function Transmitter (gw ,url)
	{    	
		this.gateway = gw;
		this.baseUrl = url;
    	this.token = null;
    	this.messages = [];
    	this.buffer = [];
    	
    	this.lock = false;
    	this.available = false;
    	this.inerror = false;
    	this.error = null;
    	
		this.onopen = function(evt)
		{ 
			this.available = true; 
			
		}.bind(this);
		
		this.onclose = function(evt)
		{ 
			this.available = false;		
			
		}.bind(this);
		
		this.onerror = function(evt)
		{ 
			this.inerror = true; 			
			this.error = evt;
			
		}.bind(this);
		
		this.onmessage = function(evt)
		{
			var json = null;
			try
			{
			    json = JSON.parse(evt.data);
			} catch(err)
			{
				json={};
				json["message"]=evt.data;
			}
			var rid = json["rid"];
			if(rid == undefined)
			{
			   rid =json["callbackId"];
			}
			evt.rid = rid;
			if(evt.token == undefined || evt.token == null)
			{
				evt.token=json["token"];
			}
			if(this.lock)
			{			
				this.buffer.push(evt);
				
			} else
			{
				if(this.buffer.length > 0)
				{
					this.messages.concat(this.buffer);
					this.buffer = [];
				}	
				this.messages.push(evt);
			}	
			if(!(this.gateway.getAuthentication() instanceof Token) && evt.token!=null)
			{
				this.gateway.setAuthentication(new Token(evt.token));
				console.log("Transmitter authentication updated : " + evt.token);
			}		
		}.bind(this);
		
		this.onsend = null;
	}

    Transmitter.prototype.send = function (method, path, parameters, headers)
    {
    	if(this.onsend == null)
    	{
    		return;
    	}
    	this.onsend(method, path, parameters, headers);
    };
	
	Transmitter.prototype.isAvailable = function(){ return this.available; };

	Transmitter.prototype.inError = function(){ return this.inerror; };

	Transmitter.prototype.getError = function(){ return this.error; };

	Transmitter.prototype.getSize = function(){ return this.messages.length; };
	
	Transmitter.prototype.getMessages = function()
	{ 
		var ms = [];
		while(this.messages.length > 0 )
		{
			ms.push(this.messages.pop());
		}
		return ms; 
	};

	Transmitter.prototype.getLock = function(){ return this.lock = true};

	Transmitter.prototype.releaseLock = function(){ return this.lock = false; };
	
	Transmitter.prototype.reset = function()
	{ 
		this.error = null;
		this.inerror = false;
	};
	
	return Transmitter;
}());

var WebSocketTransmitter = (new function (gw, url){
	
	function WebSocketTransmitter(gw, url)
	{
		Transmitter.call(this, gw, url);	
		if(this.baseUrl!=null)
		{
			this.webSocket = new WebSocket(this.baseUrl);
			this.webSocket.onopen = this.onopen;
			this.webSocket.onclose = this.onclose;
			this.webSocket.onerror = this.onerror;
			this.webSocket.onmessage = this.onmessage;
		}
		
		this.onsend = function(id, method, path, parameters, headers)
		{			
			var args = null;
			if(parameters==null)
			{
				args = [];
				
			} else 
			{
				args = parameters;
			}
			var json = {};
			json["rid"] = id;
			json["uri"] = path;

			if(headers == null)
			{
				headers = [];
			}			
            if(parameters != null)
            {
            	json["parameters"] = JSON.parse(parameters);

				 for(var i=0;i<headers.length;i++)
				 { 
					 var name = headers[i].name;
					 var value = headers[i].value;
					 if(name!=null && value!=null)
					 { 
						 json[name]=value;
				     }
				 }
            }	
            if(this.gateway.getAuthentication()!=null)
            {
            	json[this.gateway.getAuthentication().getHeaderKey()] = 
            		this.gateway.getAuthentication().getHeaderValue();
            }
            var content = JSON.stringify(json);
			this.webSocket.send(content);
			
		}.bind(this);
	};
	
	WebSocketTransmitter.prototype.close = function()
	{
		this.webSocket.close();
	};
	
	return WebSocketTransmitter;
}());

WebSocketTransmitter.prototype = Object.create(Transmitter.prototype);

var HttpTransmitter = (new function (gw, url){
	
	var Ajax = (new function(){
		
		function Ajax() {}
		
		Ajax.prototype.newRequest = function()
		{
			var xhr = null;
			if (window.XMLHttpRequest || window.ActiveXObject)
			{
				if (window.ActiveXObject) 
				{
					try 
					{
						xhr  = new ActiveXObject("Msxml2.XMLHTTP");
						
					} catch(e)
					{
						xhr  = new ActiveXObject("Microsoft.XMLHTTP");
					}
				} else
				{
					xhr  = new XMLHttpRequest(); 
					
				}
			} else 
			{
				alert("XMLHTTPRequest is not handled by your browser");
			}
			return xhr;
		};
		
		return Ajax;
		
	}());
	
	function HttpTransmitter(gw, url)
	{
		Transmitter.call(this, gw, url);
		this.ajax = new Ajax(); 
		this.onopen();
		
		this.onsend = function(id, method, path, parameters, headers)
		{		 
			var url = this.baseUrl +  path;
			var content = null;
			
			if(headers == null)
			{
				headers = [];
			}			
			if(parameters != null)
			{
				var jcontent = JSON.parse(parameters);
				content = JSON.stringify(jcontent);
			}
			var xhr = this.ajax.newRequest();
			headers.push({"name":"Accept", "value": "application/json"});
			headers.push({"name":"X-Requested-With", "value": "XmlHttpRequest"});
			headers.push({"name":"rid", "value": id});
			
			if(this.gateway.getAuthentication() != null)
			{
				headers.push({
				"name" : this.gateway.getAuthentication().getHeaderKey(),
				"value": this.gateway.getAuthentication().getHeaderValue()
				});
			}
			if(method == "GET")
			{
				 xhr.open("GET", url, true);
				 
			 } else
			 {
				 xhr.open("POST", url, true);
				 headers.push({"name":"Content-Type", "value": "application/json"});
			 }
			 for(var i=0;i<headers.length;i++)
			 { 
				 var name = headers[i].name;
				 var value = headers[i].value;
				 if(name!=null && value!=null)
				 { 
					 xhr.setRequestHeader(name,value);
			     }
			 }
			 xhr.onreadystatechange = function()
			 {
		        if(xhr.readyState==4)
		        {
					if (xhr.status >= 200 && xhr.status < 400)
					{
					   this.onmessage({
						   data  : xhr.response, 
						   token : xhr.getResponseHeader("X-Auth-Token")
					   });
					   return;
					}
					if(xhr.status >= 400)
					{
					   var message = {
						  "status"  : xhr.status, 
						  "message" : xhr.response};
					   this.onerror({
						   data  : message, 
						   token : xhr.getResponseHeader("X-Auth-Token")
					   });
					}
		        }
			 }.bind(this);
			 
			 xhr.onerror= function(e)
			 {
				console.error(e);
				
			 }.bind(this);
			 
			 xhr.send(content);
			 
		}.bind(this);
	};

	HttpTransmitter.prototype.close = function()
	{
		this.onclose(null);
	};
	
	return HttpTransmitter;
}());

HttpTransmitter.prototype = Object.create(Transmitter.prototype);
