/**
 * Lambda function handler that returns a greeting message.
 * 
 * @param {Object} event - API Gateway event object
 * @param {Object} context - Lambda context object
 * @returns {Object} API Gateway response object
 */
module.exports.hello = async (event, context) => {
  const body = {
    message: "Hello from AWS Lambda!",
    stage: process.env.STAGE || "unknown",
    input: event
  };

  const response = {
    statusCode: 200,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*"
    },
    body: JSON.stringify(body)
  };

  return response;
};

