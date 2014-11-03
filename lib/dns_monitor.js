
//node dns-monitor.js 1450 8.8.8.8 "1,1" "1451,12" "www.google.pt#checker#A#1.1.1.1,www.google.pt#checker#A#" ""

var statusId = "165:9";
var responseTimeId = "124:4";

//####################### EXCEPTIONS ################################

function InvalidParametersNumberError() {
    this.name = "InvalidParametersNumberError";
    this.message = ("Wrong number of parameters.");
}
InvalidParametersNumberError.prototype = Error.prototype;

function InvalidMetricStateError() {
    this.name = "InvalidMetricStateError";
    this.message = ("Invalid value in metric state.");
}
InvalidMetricStateError.prototype = Error.prototype;

function InvalidParametersError() {
    this.name = "InvalidParametersError";
    this.message = ("Invalid value in parameters.");
}
InvalidParametersError.prototype = Error.prototype;



// ############# INPUT ###################################

(function() {
	try
	{
		monitorInput(process.argv.slice(2));
	}
	catch(err)
	{	
		console.log(err.message);
		process.exit(1);
	}
}).call(this)



function monitorInput(args)
{
	
	if(args.length != 6)
	{
		throw new InvalidParametersNumberError()
	}		
	
	monitorInputProcess(args);
}


function monitorInputProcess(args)
{
	var dnsServer = args[1];
	
	//metric state
	var metricState = args[2].replace("\"", "");
	
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
	var cirUUDIS = args[3].replace("\"", "").split(",");
	
	// Requests.
	var dnsTestsRepresentation = args[4].replace("\"", "").split(",");
	
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
			dnsTestRepresentation.host = tokens[0];
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
		
		out += new Date(metric.ts).toISOString();
		out += "|";
		out += targetId;
		out += "|";
		out += metric.id;
		out += "|";
		out += metric.val
		out += "|";
		out += metric.obj
		//out += "\n";
		console.log(out);
	}
	
}



// ################# MONITOR ###########################
//unction getDNS(msg, mon, t, callback)
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
	  
		//console.log(message.answer)
	});

	
	
	req.on('error', function(err){
		
		processMetricOnSuccess(dnsRequest, start);
		
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

