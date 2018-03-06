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
var Runner = (function (t) {

	var Callback = (function(c, e, o)
	{	
	    function Callback(c, e, o) 
	    {
	    	this.callback = c;
	    	this.errorCallback = e;
	    	this.once = (o==undefined|o==null)?true
	    			:(o===true?true:false);
	    }

		Callback.prototype.getCallback = function()
		{
			return this.callback;
		}

		Callback.prototype.getErrorCallback = function()
		{
			return this.errorCallback;
		}
	    	
		Callback.prototype.runOnce = function()
		{
			return this.once;
		}
		
		return Callback;
	}());
	
	
	var Request = (function(i, m, u, c, h)
	{	
	    function Request(i, m, u, c, h) 
	    {
	    	this.id = i;
	    	this.method = m;
	    	if(this.method == null)
	    	{
	    		this.method = (c==null?"GET":"POST");
	    	}
	    	this.uri = u;
	    	this.content = c;
	    	this.headers = h;
	    }

	    Request.prototype.getId = function()
	    {
	    	return this.id;
	    }
	    
		Request.prototype.getMethod = function()
		{
			return this.method;
		}
	    	
		Request.prototype.getUri = function()
		{
			return this.uri;
		}

		Request.prototype.getContent = function()
		{
			return this.content;
		}
		
		Request.prototype.getHeaders = function()
		{
			return this.headers;
		}
		
		return Request;
	}());
	
    function Runner(t) {
    	
    	this.lifo = []; 
    	this.map = {};
    	this.transmitter = t;
    	this.running = false;
    	this.continueToWait = false; 
    	
        this.run = function()
    	{
    		if(!this.running || this.transmitter == undefined)
    		{
    			return;
    		}
    		if(this.lifo.length > 0)
    		{
	    		var r = this.lifo.shift();	
	    		if(r != null)
	    		{
	    			this.execute(r);
	    		}
    		} 
    		setTimeout(function(){this.run();}.bind(this),250);
    		
    	}.bind(this);
    	
    	this.execute = function(r)
    	{
    		if(!this.running)
    		{
    			return;
    		}    		
    		if(!this.transmitter.isAvailable())
    		{
    			setTimeout(function(){this.execute(r);}.bind(this),500);
    			return;
    		}
    		var id = r.getId();
    		var uri = r.getUri();
    		var method = r.getMethod();
    		var content = r.getContent();
    		var headers = r.getHeaders();
    		
    		this.transmitter.reset(); 
            this.transmitter.send(id, method, uri, content, headers);
            
    	}.bind(this);
    	
    	this.waiting = function()
    	{
    		if(!this.running)
    		{
    			return;
    		}    		
    		if(!this.transmitter.isAvailable())
    		{
    			setTimeout(function(){this.waiting();}.bind(this),500);
    			return;
    		}    		
    		if(this.transmitter.inError())
    		{
    			console.error(this.transmitter.getError());
    			this.transmitter.reset();
    			
    		} else if(this.transmitter.getSize() > 0)
    		{
    			this.transmitter.getLock();
    			var ms = this.transmitter.getMessages();
    			
    			while(ms.length > 0)
    			{
    				var m = ms.shift();
    				var d = m.data==undefined?m:m.data;
    				var i = m.rid;
    				if(i == undefined || i == null)
    				{
    					i = m.callbackId;
    				}
    				var callback = this.getMapping(i);
    				if(callback == undefined)
    				{
    					callback = new Callback( function(d){
    					    console.log("Request identifier " + i + " \n " + d);},
    						     null,false);
    				}
    				(callback.getCallback())(d);
    				if(callback.runOnce())
    				{
    					this.removeMapping(i);
    				}
    			}    			
    			this.transmitter.releaseLock();
    		}
    		setTimeout(function(){this.waiting();}.bind(this),250);
    		
    	}.bind(this);
    }
	
	Runner.prototype.start = function()
	{
		this.running = true;
		this.waiting();
		this.run();
	};
	
	Runner.prototype.stop = function()
	{
		this.transmitter.close();
		this.running = false;
	};

	Runner.prototype.error = function(e)
	{
		console.error(e);
	};

	Runner.prototype.push = function(id, method, uri, content, headers,
		callback, errorCallback, once)
	{
		var identifier = id;
		if(identifier!=null && callback!=null)
		{
			this.setMapping(identifier, callback, errorCallback, once);
		}
		var r = new Request(identifier, method, uri, content, headers);
		this.lifo.push(r);
	};

	Runner.prototype.setMapping = function(id, fun, errFun, once)
	{ 
		var identifier = id;
		if(identifier == undefined || identifier == null)
		{ 
			console.error("callback identifier expected");
			return;
		}
		var callback = new Callback(fun, errFun, once);
		this.map[identifier] = callback;
	};

	Runner.prototype.getMapping = function(id)
	{ 
		var identifier = id;
		if(identifier == undefined || identifier == null)
		{ 
			identifier = "DEFAULT";
		}
		return this.map[identifier];
	};  	

	Runner.prototype.removeMapping = function(id)
	{ 
		if(id == null || id == undefined)
		{ 
			return;
		}
		delete this.map[id];
	};  	
	
	return Runner;
	
}());  
