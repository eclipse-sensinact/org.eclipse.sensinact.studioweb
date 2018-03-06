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
var Base64 = (function(){
	
	function Base64()
	{
		this.codes = ['A','B','C','D','E','F','G','H','I','J','K','L','M','N','O','P',
			'Q','R','S','T','U','V','W','X','Y','Z','a','b','c','d','e','f','g','h',
			'i','j','k','l','m','n','o','p','q','r','s','t','u','v','w','x','y','z',
			'0','1','2','3','4','5','6','7','8','9','+','/'];
	}
	
	Base64.prototype.encode = function(s)
	{
		var l = s.length;
		var pos = 0;
		var count = 0;
		var sum = 0;
	
		var intermediate = 0x000000;	
		var result = "";	
	
		while(pos < l)
		{
			var charcode = s.charCodeAt(pos);
			
			count=(charcode < 0x100)?8:16;
			intermediate <<= count;
			intermediate |= charcode;
			
			sum+=count;
			pos++;
			
			if(sum == 24 | pos == l)
			{	
				while(sum % 6 != 0)
				{
					intermediate <<= 1;
					sum++;
				}			
				var offset = sum/6;
				for(var  i= offset; i > 0 ; i--)
				{
					result += this.codes[((intermediate >>> (6*(i-1))) & 0x00003F)];				
				}			
				while(sum < 24)
				{
					sum+=6;
					result+='=';
				}
				sum = 0;
				intermediate = 0x000000;
			}
		}
		return result;
	};

	Base64.prototype.decode = function(s)
	{
		var aUpperCode = 'A'.charCodeAt(0);
		var zUpperCode = 'Z'.charCodeAt(0);
		var aLowerCode = 'a'.charCodeAt(0);
		var zLowerCode = 'z'.charCodeAt(0);
		var zeroCode = '0'.charCodeAt(0);
		var nineCode = '9'.charCodeAt(0);
	
		var l = s.length;
		var pos = 0;
		var count = 0;
		var sum = 0;
	
		var intermediate = 0x000000;	
		var result = "";	
	
		while(pos < l)
		{
			var ch = s.charAt(pos);
			var charcode = ch.charCodeAt(0);
			var index = -1;
			
			switch(ch)
			{
				case '=': index = -1;
				break;
				case '+': index = 62;
				break;
				case '/': index = 63;
				break;
				default:
					if(charcode >= aUpperCode && charcode <= zUpperCode)
					{
						index = (charcode - aUpperCode);
						
					} else if(charcode >= aLowerCode && charcode <= zLowerCode)
				    {
						index = (charcode - aLowerCode) + 26;
						
				    } else if(charcode >= zeroCode && charcode <= nineCode)
				    {
				    	index = (charcode - zeroCode) + 52
				    }
			}		
			if(index > -1)
			{
				intermediate <<= 6;
				intermediate |= index;
				sum+=6;
			}
			pos++;
			
			if(sum == 24 | pos == l)
			{	
				while(sum % 8 != 0)
				{
					intermediate >>>= 1;
					sum--;
				}			
				var offset = sum/8;
				for(var  i= offset; i > 0 ; i--)
				{
					result += String.fromCharCode(
						(intermediate >>> (8*(i-1))) & 0x0000FF);
				}
				sum = 0;
				intermediate = 0x000000;
			}
		}
		return result;
	};
	
	return Base64;
}());

var Authentication = (function(){
	
	function Authentication()
	{
		this.headerKey = null;
		this.headerValue = null;		
	};
	
	Authentication.prototype.getHeaderKey = function()
	{
		return this.headerKey;
	};
	
	Authentication.prototype.getHeaderValue = function()
	{
		return this.headerValue;
	};
	
	return Authentication;
	
}());

var Credentials = (function(login, password){
	
	function Credentials(login, password)
	{
		Authentication.call(this);
		this.headerKey = "Authorization";
		this.headerValue = "Basic " + new Base64().encode(login+":"+password);
	};
	
	return Credentials;

}());

Credentials.prototype = Object.create(Authentication.prototype);

var Token = (function(token){
	
	function Token(token)
	{
		Authentication.call(this);
		this.headerKey = "X-Auth-Token";
		this.headerValue = token;
	};
	
	return Token;	
}());

Token.prototype = Object.create(Authentication.prototype);
