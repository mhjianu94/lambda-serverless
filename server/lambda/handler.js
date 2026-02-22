
module.exports.hello = async (event, context) => {
  const body = {
    message: "Hello from AWS Lambda! ",
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

module.exports.auth = async (event, context) => {
  const body = {
    message: "Auth from AWS Lambda!",
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

module.exports.db = async (event, context) => {
  const body = {
    message: "DB-backed Lambda (connect via DB_PROXY_ENDPOINT and DB_SECRET_ARN)",
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