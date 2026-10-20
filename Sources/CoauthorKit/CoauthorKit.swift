import Foundation

/// One register's LWW stamp.
/// Matches the TypeScript `RegisterStamp<T>` wire format identically.
public struct RegisterStamp<Value: Codable & Equatable & Sendable>: Codable, Equatable, Sendable {
    public var rev: Int
    public var clientID: String
    public var schemaVersion: Int
    public var value: Value?

    public init(
        rev: Int,
        clientID: String,
        schemaVersion: Int,
        value: Value?
    ) {
        self.rev = rev
        self.clientID = clientID
        self.schemaVersion = schemaVersion
        self.value = value
    }

    /// Merges two register stamps using join-semilattice rules:
    /// 1. Schema version guard
    /// 2. Higher rev wins
    /// 3. Higher clientID wins (lexicographical tie-break)
    /// 4. Canonical UTF-8 JSON byte tie-break
    public func merged(
        with other: RegisterStamp<Value>,
        currentSupportedVersion: Int = RecipePackageSchemaCurrentVersion
    ) -> RegisterStamp<Value> {
        // Schema protection
        if self.schemaVersion > other.schemaVersion { return self }
        if other.schemaVersion > currentSupportedVersion { return other }

        // 1. Revision ordering
        if other.rev > self.rev { return other }
        if self.rev > other.rev { return self }

        // 2. Client ID tie-break
        if other.clientID > self.clientID { return other }
        if self.clientID > other.clientID { return self }

        // 3. Byte-level tie-break
        if self.value == other.value { return other }
        guard let aData = try? JSONEncoder().encode(self.value),
              let bData = try? JSONEncoder().encode(other.value) else {
            return other
        }
        return bData.lexicographicallyPrecedes(aData) ? self : other
    }
}

public let RecipePackageSchemaCurrentVersion: Int = 1

public enum FractionalPosition {
    private static let digits = Array("0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz")

    public static func between(_ prev: String?, _ next: String?) -> String {
        let p = prev ?? ""
        let n = next ?? ""
        if p.isEmpty && n.isEmpty { return "V" }
        if p.isEmpty {
            let first = n.first ?? "V"
            if let idx = digits.firstIndex(of: first), idx > 0 {
                return String(digits[idx / 2]) + n.dropFirst()
            }
            return "0" + between("", String(n.dropFirst()))
        }
        if n.isEmpty {
            if let last = p.last, let idx = digits.firstIndex(of: last), idx < digits.count - 2 {
                return String(p.dropLast()) + String(digits[idx + 1])
            }
            return p + "V"
        }
        var i = 0
        let pArr = Array(p)
        let nArr = Array(n)
        while i < pArr.count && i < nArr.count && pArr[i] == nArr[i] {
            i += 1
        }
        let pChar = i < pArr.count ? pArr[i] : "0"
        let nChar = i < nArr.count ? nArr[i] : "z"
        let pIdx = digits.firstIndex(of: pChar) ?? 0
        let nIdx = digits.firstIndex(of: nChar) ?? (digits.count - 1)

        if nIdx - pIdx > 1 {
            let mid = (pIdx + nIdx) / 2
            return String(pArr.prefix(i)) + String(digits[mid])
        }
        return String(pArr.prefix(i + 1)) + between(String(pArr.dropFirst(i + 1)), nil)
    }
}
