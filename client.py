import requests
from time import sleep
from random import randint

for i in range(1500):
    data = {"albumId": randint(1, 15)}
    r = requests.post("http://127.0.0.1:8001/get_other_albums_from_artists", json=data)
    print(r)
    sleep(5)
