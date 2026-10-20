// swift-tools-version: 6.0
import PackageDescription

let package = Package(
    name: "CoauthorKit",
    platforms: [
        .iOS(.v17),
        .macOS(.v14)
    ],
    products: [
        .library(
            name: "CoauthorKit",
            targets: ["CoauthorKit"]
        )
    ],
    targets: [
        .target(
            name: "CoauthorKit",
            dependencies: [],
            path: "Sources/CoauthorKit"
        ),
        .testTarget(
            name: "CoauthorKitTests",
            dependencies: ["CoauthorKit"],
            path: "Tests/CoauthorKitTests"
        )
    ]
)
