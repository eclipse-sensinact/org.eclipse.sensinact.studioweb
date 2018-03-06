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
var Gateway = (function () {
	
	var RequestIDGenerator = (function(){
		
		function RequestIDGenerator()
		{}
		
		RequestIDGenerator.prototype.nextID = function()
		{
			var now = (new Date).getTime();
			now+= Math.floor(Math.random()*10000000);
			return "req"+now;			
		}
		
		return RequestIDGenerator;
	}());
	
    function Gateway(host, port, timeout) 
    {    	
    	this.authentication = null;
        this.connected = false;
        this.runners = [];
        this.host = host;
        this.port = port;
        this.timeout = timeout;
        this.sid = undefined;
        this.sidLoc = undefined;
        this.generator = new RequestIDGenerator();
    }
    
    Gateway.prototype.errorConnection = function (obj, errStr) {
    };
    
    Gateway.prototype.isConnected = function () {
        return this.connected;
    };
    
    Gateway.prototype.getHost = function () {
        return this.host;
    };
    
    Gateway.prototype.setHost = function (host) {
        this.host = host;
    };
    
    Gateway.prototype.getPort = function () {
        return this.port;
    };
    
    Gateway.prototype.setPort = function (port) {
        this.port = port;
    };
    
    Gateway.prototype.getTimeout = function () {
        return this.timeout;
    };
    
    Gateway.prototype.setTimeout = function (timeout) {1
        this.timeout = timeout;
    };
    
    Gateway.prototype.getConnectionTime = function () {
        return this.connectionTime;
    };
    
    Gateway.prototype.getRefreshTime = function () {
        return this.refreshTime;
    };

    Gateway.prototype.getHttpURL = function()
    {
    	var url = "http://" + this.host + ":" + this.port ;
    	return url;
    };
    
    Gateway.prototype.getWebSocketURL = function()
    {
    	var url = "ws://" + this.host + ":" + this.port + "/ws";
    	return url;
    }; 
    
    Gateway.prototype.formatURL = function(segments, method, http) 
    {
    	var url=(http != null && http)?this.getHttpURL():this.getWebSocketURL(); 
    	url += this.path(segments);

        if(method !== undefined)
    	{
    		url += "/" + method;
    	}
        return url;
    };

    Gateway.prototype.connect = function(agentCallback, agentClosing)
    {
    	this.connected = true;
    	this.runners.push(new Runner(new HttpTransmitter(this, 
    		this.formatURL([], undefined, true))));
    	
    	this.runners[0].start();
    	
    	this.runners.push(new Runner(new WebSocketTransmitter(this,
    		this.formatURL(["sensinact"], undefined, false)))); 
    	
    	this.runners[1].start();      

    	var c = agentCallback==null?function(f){console.log(f)}:agentCallback;
    	this.runners[1].setMapping("DEFAULT", c, null, false);
    	
		this.request("POST",["sensinact","SUBSCRIBE"],
	    "[{\"name\":\"sender\",\"type\":\"string\",\"value\":\"/[^/]+/admin/location(/[^/]+)?\"},"+
		"{\"name\":\"pattern\",\"type\":\"boolean\",\"value\":true},"+
		"{\"name\":\"complement\",\"type\":\"boolean\",\"value\":false}," +
		"{\"name\":\"types\",\"type\":\"array\",\"value\":[\"UPDATE\"]}]",
		[], function(e)
    	{
    		var json = JSON.parse(e);    		
    		if(json.type === "SUBSCRIBE_RESPONSE")
    		{
    			this.sidLoc = json.response.subscriptionId;
    		} 		
    	}.bind(this), function(e){console.error(e);}, true);

		this.request("POST",["sensinact","SUBSCRIBE"],
		"[{\"name\":\"sender\",\"type\":\"string\",\"value\":\"(/[^/]+)+\"}," +
		"{\"name\":\"pattern\",\"type\":\"boolean\",\"value\":true}," +
		"{\"name\":\"complement\",\"type\":\"boolean\",\"value\":false}," +
		"{\"name\":\"types\",\"type\":\"array\",\"value\":[\"LIFECYCLE\"]}]",
		[], function(e)
    	{
    		var json = JSON.parse(e);    		
    		if(json.type === "SUBSCRIBE_RESPONSE")
    		{
    			this.sid = json.response.subscriptionId;
    			(this.runners[1].getMapping("DEFAULT").getCallback())(null);
    		}   		
    	}.bind(this), function(e){console.error(e);}, true);
    }
    
    Gateway.prototype.path = function(segments) 
    {
    	var path="";    	
    	var length = segments==null?0:segments.length;
    	
        for (var i = 0; i < length; i++) 
        {
            path+= "/" + segments[i];
        }
        return path;
    };

    Gateway.prototype.disconnect = function () 
    {
    	this.connected = false;
    	this.runners[1].removeMapping("DEFAULT");
    	
    	if(this.sid != null)
    	{
    		this.request("POST",["sensinact","UNSUBSCRIBE"],
    		"[{\"name\":\"subscriptionId\",\"type\":\"string\",\"value\":\""+
    		this.sid+"\"}]", [], null, null, true);
    	}
    	if(this.sidLoc != null)
    	{
    		this.request("POST",["sensinact","UNSUBSCRIBE"],
    	    "[{\"name\":\"subscriptionId\",\"type\":\"string\",\"value\":\""+
    	    this.sidLoc+"\"}]", [], null, null, true);
    	}
    	this.runners[0].stop();
    	this.runners[0] = null;
    	
    	this.runners[1].stop();
    	this.runners[1] = null;
    	
        this.connectionTime = null;
        this.refreshTime = null;
    }; 

    Gateway.prototype.request = function (
    	method, segments, parameters, headers, callback, 
    	errorCallback, once) 
    {
    	var m = (segments!=null && segments.length > 0)
    	?segments[segments.length -1]:null;
    	
    	if(m==null)
    	{
    		console.error("invalid request path");
    		return;
    	}    
    	var content = null;
    	var strContent = null;
    	
    	if (typeof parameters === 'string' || parameters instanceof String)
    	{
    		strContent = parameters;
    		content = JSON.parse(parameters);
    		
    	} else
    	{
    		content = parameters;
    		strContent = JSON.stringify(parameters);
    	}	
    	var runner = (m==="SUBSCRIBE"|| m==="UNSUBSCRIBE")
    	?this.runners[1]:this.runners[0];
    	
    	if(m === "UNSUBSCRIBE")
    	{  
    		runner.removeMapping(content[0].value);
    	}
    	runner.push(this.generator.nextID(), method, 
    		this.path(segments), strContent, headers, 
    		callback, errorCallback, once);
    };

	Gateway.prototype.setAuthentication = function(a)
	{ 
		if(a instanceof Authentication)
		{
			this.authentication = a;
		}
	};

	Gateway.prototype.getAuthentication = function()
	{ 
		return this.authentication;
	};
	
    return Gateway;
	}());

var Gateways = (function () {
    function Gateways() {
        this.dict = {};
    }
    return Gateways;
}());

var GatewaysSingleton = (function () {
    function GatewaysSingleton() {
    }
    GatewaysSingleton.get = function () {
        if (!this.instance) {
            this.instance = new Gateways();
        }
        return this.instance;
    };
    return GatewaysSingleton;
}());