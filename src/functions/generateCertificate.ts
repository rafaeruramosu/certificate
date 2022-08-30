import { readFileSync } from "fs";
import * as path from "path";

import { APIGatewayProxyHandler } from "aws-lambda";
import * as handlebars from 'handlebars';
import * as dayjs from 'dayjs'

import { document } from '../utils/dynamodbClient';

type CreateCertificate = {
  id: string;
  name: string;
  grade: string;
}

type Template = {
  id: string;
  name: string;
  grade: string;
  medal: string;
  date: string;
}

const compile = async (data: Template) => {
  const filePath = path.join(process.cwd(), 'src', 'templates', 'certificate.hbs');

  const html = readFileSync(filePath, 'utf-8');

  return handlebars.compile(html)(data);
}

export const handler: APIGatewayProxyHandler = async (event) => {
  const { id, name, grade } = JSON.parse(event.body) as CreateCertificate;

  await document.put({
    TableName: 'users_certificate',
    Item: {
      id,
      name,
      grade,
      created_at: new Date().getTime()
    }
  }).promise();

  const response = await document.query({
    TableName: 'users_certificate',
    KeyConditionExpression: 'id = :id',
    ExpressionAttributeValues: {
      ':id': id
    }
  }).promise();

  const medalPath = path.join(process.cwd(), 'src', 'templates', 'selo.png');

  const medal = readFileSync(medalPath, 'base64');

  const data: Template = {
    id,
    name, 
    grade,
    medal,
    date: dayjs().format('DD/MM/YYYY'),
  }

  const content = await compile(data)

  return {
    statusCode: 201,
    body: JSON.stringify(response.Items[0])
  }
}