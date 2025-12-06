import os

result = []
for i in os.listdir('imgs'):
    result.append(i.split('.')[0])
print(result)

