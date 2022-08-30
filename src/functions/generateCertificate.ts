import { readFileSync } from "fs";
import path from "path";

import { APIGatewayProxyHandler } from "aws-lambda";
import chromium from 'chrome-aws-lambda';
import handlebars from 'handlebars';
import dayjs from 'dayjs'

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
  };

  const content = await compile(data);

  const browser = await chromium.puppeteer.launch({
    args: chromium.args,
    defaultViewport: chromium.defaultViewport,
    executablePath: await chromium.executablePath,
  });

  const page = await browser.newPage();

  await page.setContent(content);
  
  const pdf = await page.pdf({
    format: 'a4',
    landscape: true,
    printBackground: true,
    preferCSSPageSize: true,
    path: process.env.IS_OFFLINE ? './certificate.pdf' : null
  });

  await browser.close();

  return {
    statusCode: 201,
    body: JSON.stringify(response.Items[0]),
  };
};