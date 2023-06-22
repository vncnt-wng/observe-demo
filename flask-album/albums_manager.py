from trace_utils import trace_function
import json
from time import sleep
from random import randint
from typing import List


class AlbumsManager:
    def __init__(self):
        file = "database.json"
        f = open(file)
        self.data = json.load(f)

    @trace_function
    def get_artists_on_album(self, albumId: int):
        artists = self.data[albumId - 1]["artists"]
        sleep((randint(5, 10) * len(artists)) / 1000)
        return artists

    @trace_function
    def get_albums_by_artist(self, artist_name):
        albums = []
        sleep(randint(15, 20) / 1000)
        for album in self.data:
            if artist_name in album["artists"]:
                albums.append(album)
        return albums
