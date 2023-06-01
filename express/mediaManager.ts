import { traceFunction, traceFunctionAsync } from "./trace_utils";

export class MediaManager {
    storageBackend: Backend

    constructor() {
        this.storageBackend = new Backend()
    }

    @traceFunction
    getThumbnailsForAlbums(ids: string[]) {
        return ids.map((id) => this.storageBackend.getThumbnail(id))
    }

    @traceFunction
    getThumbnailsForIdsAsync(ids: string[]) {
        const thumbnails = []
        for (const id of ids) {
            const thumbnail = this.storageBackend.getThumbnailAsync(id)
            thumbnails.push(thumbnail)
        }
        // return ids.map(async (id) => await this.storageBackend.getThumbnail(id))
        return thumbnails
    }
}

class Backend {
    @traceFunction
    getThumbnail(id) {
        sleepRandom(75, 150)
        return id + "thumbnail"
    }

    @traceFunctionAsync
    async getThumbnailAsync(id) {
        sleepRandom(75, 150)
        return id + "thumbnail"
    }
}





function sleepRandom(millisMin, millisMax) {
    const randomMillis = Math.floor(Math.random() * (millisMax - millisMin) + millisMin)
    const date = Date.now();
    let currentDate = null;
    do {
        currentDate = Date.now();
    } while (currentDate - date < randomMillis);
}