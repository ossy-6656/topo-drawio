import fs from 'node:fs'
import path from 'node:path'
import type { Connect, Plugin } from 'vite'

const CIM_G_ELEMENT_ROOT = path.resolve(__dirname, '../scripts/CIM-G/element')
export const CIM_G_ELEMENT_URL_PREFIX = '/__cim-g-element/'

function attachCimGElementMiddleware(middlewares: Connect.Server) {
    middlewares.use(CIM_G_ELEMENT_URL_PREFIX, (req, res, next) => {
        if (!req.url) {
            next()
            return
        }
        const rel = decodeURIComponent(req.url.split('?')[0].replace(/^\//, ''))
        if (!rel || rel.includes('..')) {
            res.statusCode = 403
            res.end('Forbidden')
            return
        }
        const filePath = path.normalize(path.join(CIM_G_ELEMENT_ROOT, rel))
        if (!filePath.startsWith(CIM_G_ELEMENT_ROOT)) {
            res.statusCode = 403
            res.end('Forbidden')
            return
        }
        if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
            next()
            return
        }
        res.setHeader('Content-Type', 'application/octet-stream')
        fs.createReadStream(filePath).pipe(res)
    })
}

/** 开发/预览：按路径提供 CIM-G 图元 .g（文件名可含 #、中文等，避免 import.meta.glob 解析失败） */
export function cimGElementPlugin(): Plugin {
    return {
        name: 'vite-cim-g-element',
        configureServer(server) {
            attachCimGElementMiddleware(server.middlewares)
        },
        configurePreviewServer(server) {
            attachCimGElementMiddleware(server.middlewares)
        },
    }
}
