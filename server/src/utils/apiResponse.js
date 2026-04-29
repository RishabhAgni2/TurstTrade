export const successResponses = (res,statusCode=200,message='success',date = {})=>
    res.status(statusCode).json({success: true, message, data});

export const errorResponse = (res,statusCode=500, message='Something went wrong')=>
    res.status(statusode).json({success: false,message});