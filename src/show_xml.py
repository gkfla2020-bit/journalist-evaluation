import boto3
import re

s3 = boto3.client('s3', region_name='us-east-1')
r = s3.get_object(Bucket='sedaily-news-xml-storage', Key='daily-xml/20260112.xml')
c = r['Body'].read().decode('utf-8')

# 지면기사(1면) 하나만 출력
items = re.findall(r'<item type="text">.*?</item>', c, re.DOTALL)
for item in items:
    if '<paperNumber>1</paperNumber>' in item:
        print(item)
        break
