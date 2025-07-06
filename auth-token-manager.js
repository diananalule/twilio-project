import fs from "node:fs/promises"
import path from "node:path"
import { jwtDecode } from "jwt-decode"


class AuthTokenManager {
    constructor(filePath) {
        this.filePath = filePath
    }

    static async create(tokenFilePath) {
        const manager = new AuthTokenManager(tokenFilePath)
        
        try {
            await fs.access(tokenFilePath)
        } catch {
            // File doesn't exist, create it
            try {
                const dirPath = path.dirname(tokenFilePath)
                await fs.mkdir(dirPath, { recursive: true })
                await fs.writeFile(tokenFilePath, JSON.stringify({ access_token: {} }, null, 2), { flag: "wx" })
            } catch (err) {
                throw new Error(`Failed to create file: ${tokenFilePath}`)
            }
        }
        return manager
    }

    async save(accessToken) {
        let fileData;
        try {
            const data = await fs.readFile(this.filePath, 'utf8')
            fileData = JSON.parse(data)
        } catch (err) {
            fileData = { access_token: {} }
        }

        fileData.access_token.token = accessToken
        fileData.access_token.timestamp = new Date().toISOString()

        await fs.writeFile(this.filePath, JSON.stringify(fileData, null, 2))
    }

    async read() {
        try {
            const data = await fs.readFile(this.filePath, 'utf8')
            const fileData = JSON.parse(data)
            return fileData.access_token?.token || null
        } catch (err) {
            return null
        }
    }

    async delete() {
        try {
            await fs.unlink(this.filePath)
        } catch (err) {
            // File might not exist, which is fine
            if (err.code !== 'ENOENT') {
                throw new Error(`Failed to delete file: ${this.filePath}`)
            }
        }
    }

    async clear() {
        try {
            const fileData = { access_token: {} }
            await fs.writeFile(this.filePath, JSON.stringify(fileData, null, 2))
        } catch (err) {
            throw new Error(`Failed to clear token data: ${err.message}`)
        }
    }

    async isExpired() {
        try {
            const data = await fs.readFile(this.filePath, 'utf8')
            const fileData = JSON.parse(data)
            
            const token = fileData.access_token?.token
            if (!token) {
                return true
            }
            
            const payload = jwtDecode(token)
            const exp = payload.exp
            if (!exp) {
                // If no expiration claim, consider it expired
                return true
            }
            
            const now = Math.floor(Date.now() / 1000) // Current time in seconds
            return now >= exp
        } catch (err) {
            // If file doesn't exist, can't be read, or JWT is invalid, consider token expired
            return true
        }
    }

    async exists() {
        try {
            await fs.access(this.filePath)
            return true
        } catch {
            return false
        }
    }
}

export default AuthTokenManager