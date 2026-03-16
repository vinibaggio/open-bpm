import ExpoModulesCore

public class ExpoSevenSegmentReaderModule: Module {
  public func definition() -> ModuleDefinition {
    Name("ExpoSevenSegmentReader")

    // Stub — 7-segment reader is paused, will be implemented later
    AsyncFunction("readDisplay") { (imageUri: String, promise: Promise) in
      promise.reject("NOT_IMPLEMENTED", "7-segment reader is not yet implemented")
    }
  }
}
