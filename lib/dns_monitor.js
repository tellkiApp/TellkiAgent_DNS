
var statusId = "165:Status:9";
var responseTimeId = "124:Response Time:7";

//####################### EXCEPTIONS ################################

function InvalidParametersNumberError() {
    this.name = "InvalidParametersNumberError";
    this.message = "Wrong number of parameters.";
	this.code = 3;
}
InvalidParametersNumberError.prototype = Object.create(Error.prototype);
InvalidParametersNumberError.prototype.constructor = InvalidParametersNumberError;

function InvalidMetricStateError() {
    this.name = "InvalidMetricStateError";
    this.message = "Invalid value in metric state.";
	this.code = 9;
}
InvalidMetricStateError.prototype = Object.create(Error.prototype);
InvalidMetricStateError.prototype.constructor = InvalidMetricStateError;

function InvalidParametersError() {
    this.name = "InvalidParametersError";
    this.message = "Invalid value in parameters.";
	this.code = 10;
}
InvalidParametersError.prototype = Object.create(Error.prototype);
InvalidParametersError.prototype.constructor = InvalidParametersError;



// ############# INPUT ###################################

(function() {
	try
	{
		monitorInput(process.argv.slice(2));
	}
	catch(err)
	{	
		if(err instanceof InvalidParametersNumberError)
		{
			console.log(err.message);
			process.exit(err.code);
		}
		else if(err instanceof InvalidMetricStateError)
		{
			console.log(err.message);
			process.exit(err.code);
		}
		else if(err instanceof InvalidParametersError)
		{
			console.log(err.message);
			process.exit(err.code);
		}
		else
		{
			console.log(err.message);
			process.exit(1);
		}
	}
}).call(this)



function monitorInput(args)
{	
	if(args.length != 4)
	{
		throw new InvalidParametersNumberError()
	}		
	
	monitorInputProcess(args);
}


function monitorInputProcess(args)
{
	var dnsServer = args[0];
	
	//metric state
	var metricState = args[1];
	
	var tokens = metricState.split(",");

	var checkStatus = false;
	var checkTimeout = false;
	
	if (tokens.length == 2)
	{
		if (tokens[0] == "1")
		{
			checkStatus = true;
		}

		if (tokens[1] == "1")
		{
			checkTimeout = true;
		}
	}
	else
	{
		throw new InvalidMetricStateError();
	}
	
	
	//metric state
	var cirUUDIS = args[2].split(",");
	
	// Requests.
	var dnsTestsRepresentation = args[3].split(",");
	
	var dnsQueryRequests = [];

	var i = 0;
	for (var j in dnsTestsRepresentation)
	{
		var tokens = dnsTestsRepresentation[j].split("#", 4);
		
		if (tokens.length == 4)
		{
			var dnsTestRepresentation = new Object();
			dnsTestRepresentation.dnsServer = dnsServer
			dnsTestRepresentation.cirUUDI = cirUUDIS[i];
			dnsTestRepresentation.record = tokens[2];
			dnsTestRepresentation.host = tokens[0].split(";")[1];
			dnsTestRepresentation.ipMatch = tokens[3];
			dnsTestRepresentation.checkStatus = checkStatus;
			dnsTestRepresentation.checkTimeout = checkTimeout;
			
			dnsQueryRequests.push(dnsTestRepresentation);
		}
		else
		{
			throw new InvalidParametersError();
		}

		i++;
	}
	
	
	monitorDNS(dnsQueryRequests);
	
}




//################### OUTPUT ###########################

function output(metrics, targetId)
{
	for(var i in metrics)
	{
		var out = "";
		var metric = metrics[i];
		
		out += targetId;
		out += "|";
		out += metric.id;
		out += "|";
		out += metric.val
		out += "|";
		out += metric.obj
		out += "|";
		
		console.log(out);
	}
}



// ################# MONITOR ###########################

function monitorDNS(dnsQueryRequests) 
{
	for(var i in dnsQueryRequests)
	{
		var start = Date.now();
		
		var dnsRequest = dnsQueryRequests[i];
		
		dns(dnsRequest, start)
	}
}


function dns(dnsRequest, start)
{
	var dns = require('native-dns');
	
	var message = "";
	
	var question = dns.Question({
		name: dnsRequest.host,
		type: dnsRequest.record,
	});

	
	var req = dns.Request({
		question: question,
		server: { address: dnsRequest.dnsServer},
	});

	
	req.on('timeout', function () {
		processMetricOnError(dnsRequest, start)
	});
	

	req.on('message', function (err, response) {
		
		if(response.answer.length > 0)
		{
			var result = 0;
			
			if(dnsRequest.ipMatch === "")
			{
				result = 1;
			}
			else
			{
				for (var i in response.answer) 
				{

					if (response.answer[i].address === dnsRequest.ipMatch) 
					{
						result = 1;
						break;
					}
				}
			}
			
			if(result === 0)
				processMetricOnError(dnsRequest, start);
			else
				processMetricOnSuccess(dnsRequest, start);

		}
		else
		{
			processMetricOnError(dnsRequest, start);
		}
	});

	
	
	req.on('error', function(err){
		
		processMetricOnError(dnsRequest, start);
		
	});

	req.send();
	
}


function processMetricOnError(request, start)
{
	var metrics = [];
	
	var metric = new Object();
	metric.id = statusId;
	metric.val = 0;
	metric.ts = start;
	metric.exec = Date.now() - start;
	metric.obj = request.host

	metrics.push(metric);

	output(metrics, request.cirUUDI);
}


function processMetricOnSuccess(request, start)
{
	var metrics = [];
	
	if(request.checkStatus)
	{
		var metric = new Object();
		metric.id = statusId;
		metric.val = 1;
		metric.ts = start;
		metric.exec = Date.now() - start;
		metric.obj = request.host

		metrics.push(metric);
	}
	
	if(request.checkTimeout)
	{
		var metric = new Object();
		metric.id = responseTimeId;
		metric.val = Date.now() - start;
		metric.ts = start;
		metric.exec = Date.now() - start;
		metric.obj = request.host

		metrics.push(metric);
	}
	
	output(metrics, request.cirUUDI);
}

