import requests
from time import sleep
from random import randint

for i in range(3000):
    data = {"albumId": randint(1, 15)}
    r = requests.post("http://127.0.0.1:3001/get_all_data_for_album_page", json=data)
    print(r)
    sleep(2)
