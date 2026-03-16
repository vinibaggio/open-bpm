import ExpoModulesCore
import UIKit

public class ExpoSevenSegmentReaderModule: Module {
  public func definition() -> ModuleDefinition {
    Name("ExpoSevenSegmentReader")

    AsyncFunction("readDisplay") { (imageUri: String, promise: Promise) in
      guard let url = URL(string: imageUri) else {
        promise.reject("INVALID_URI", "Invalid image URI")
        return
      }

      DispatchQueue.global(qos: .userInitiated).async {
        do {
          let data = try Data(contentsOf: url)
          guard let image = UIImage(data: data) else {
            promise.reject("INVALID_IMAGE", "Could not load image from URI")
            return
          }

          var error: NSError?
          let reading = SevenSegmentReader.readDisplay(from: image, error: &error)

          if let error = error {
            promise.reject("READER_ERROR", error.localizedDescription)
            return
          }

          guard let reading = reading else {
            promise.reject("READER_ERROR", "Could not read display")
            return
          }

          var result: [String: Any] = [
            "systolic": reading.systolic,
            "diastolic": reading.diastolic,
          ]
          if reading.hasHeartRate {
            result["heartRate"] = reading.heartRate
          }

          promise.resolve(result)
        } catch {
          promise.reject("LOAD_ERROR", "Could not load image: \(error.localizedDescription)")
        }
      }
    }
  }
}
