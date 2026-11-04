// macOS: swift docs/generar_iconos.swift web/public
import AppKit
let salida = CommandLine.arguments[1]
for (nombre, lado) in [("pwa-192x192.png", 192), ("pwa-512x512.png", 512), ("apple-touch-icon.png", 180)] {
    let imagen = NSBitmapImageRep(bitmapDataPlanes: nil, pixelsWide: lado, pixelsHigh: lado, bitsPerSample: 8, samplesPerPixel: 4, hasAlpha: true, isPlanar: false, colorSpaceName: .deviceRGB, bytesPerRow: 0, bitsPerPixel: 0)!
    let contexto = NSGraphicsContext(bitmapImageRep: imagen)!
    NSGraphicsContext.saveGraphicsState()
    NSGraphicsContext.current = contexto
    contexto.cgContext.scaleBy(x: CGFloat(lado) / 512, y: CGFloat(lado) / 512)
    NSColor(srgbRed: 37/255, green: 99/255, blue: 235/255, alpha: 1).setFill()
    NSBezierPath(rect: NSRect(x: 0, y: 0, width: 512, height: 512)).fill()
    NSColor.white.setStroke()
    let asa = NSBezierPath(roundedRect: NSRect(x: 211, y: 338, width: 90, height: 76), xRadius: 32, yRadius: 32)
    asa.lineWidth = 20
    asa.stroke()
    NSColor.white.setFill()
    NSBezierPath(roundedRect: NSRect(x: 136, y: 108, width: 240, height: 258), xRadius: 58, yRadius: 58).fill()
    NSColor(srgbRed: 219/255, green: 234/255, blue: 254/255, alpha: 1).setFill()
    NSBezierPath(roundedRect: NSRect(x: 165, y: 138, width: 182, height: 100), xRadius: 24, yRadius: 24).fill()
    NSColor(srgbRed: 37/255, green: 99/255, blue: 235/255, alpha: 1).setStroke()
    let cremallera = NSBezierPath()
    cremallera.move(to: NSPoint(x: 186, y: 211))
    cremallera.line(to: NSPoint(x: 326, y: 211))
    cremallera.lineWidth = 12
    cremallera.lineCapStyle = .round
    cremallera.stroke()
    NSGraphicsContext.restoreGraphicsState()
    try imagen.representation(using: .png, properties: [:])!.write(to: URL(fileURLWithPath: salida + "/" + nombre))
}
