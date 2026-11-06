import Foundation
import Vision
import CoreImage

// 用法：swift cutout.swift <输入目录> <输出目录>
// 对每张 jpg 做前景实例分割，每个实例单独输出一张透明底 PNG（裁到实例范围）
let args = CommandLine.arguments
let inDir = URL(fileURLWithPath: args[1]), outDir = URL(fileURLWithPath: args[2])
let ctx = CIContext()
let files = try FileManager.default.contentsOfDirectory(atPath: inDir.path).filter { $0.hasSuffix(".jpg") }.sorted()
for f in files {
    guard let ci = CIImage(contentsOf: inDir.appendingPathComponent(f)) else { continue }
    let req = VNGenerateForegroundInstanceMaskRequest()
    let h = VNImageRequestHandler(ciImage: ci)
    do { try h.perform([req]) } catch { print("\(f)\tERR"); continue }
    guard let obs = req.results?.first else { print("\(f)\t0"); continue }
    let base = (f as NSString).deletingPathExtension
    var n = 0
    do { if obs.allInstances.count > 1, let buf = try? obs.generateMaskedImage(ofInstances: obs.allInstances, from: h, croppedToInstancesExtent: true) { try? ctx.writePNGRepresentation(of: CIImage(cvPixelBuffer: buf), to: outDir.appendingPathComponent("\(base)_all.png"), format: .RGBA8, colorSpace: CGColorSpace(name: CGColorSpace.sRGB)!) } }
    for inst in obs.allInstances {
        guard let buf = try? obs.generateMaskedImage(ofInstances: IndexSet(integer: inst), from: h, croppedToInstancesExtent: true) else { continue }
        let img = CIImage(cvPixelBuffer: buf)
        let out = outDir.appendingPathComponent("\(base)_i\(inst).png")
        try? ctx.writePNGRepresentation(of: img, to: out, format: .RGBA8, colorSpace: CGColorSpace(name: CGColorSpace.sRGB)!)
        n += 1
    }
    print("\(f)\t\(n)")
}
