import Testing
@testable import CoauthorKit

@Suite("CoauthorKit Tests")
struct CoauthorKitTests {
    @Test("Join-semilattice merge satisfies commutativity and associativity")
    func testSemilatticeMerge() {
        let a = RegisterStamp(rev: 1, clientID: "a", schemaVersion: 1, value: "hello")
        let b = RegisterStamp(rev: 2, clientID: "b", schemaVersion: 1, value: "world")

        #expect(a.merged(with: b) == b.merged(with: a))
        #expect(a.merged(with: b) == b)
    }

    @Test("Fractional position generator produces strictly ordered strings")
    func testFractionalPositions() {
        let p1 = FractionalPosition.between(nil, nil)
        #expect(p1 == "V")

        let p0 = FractionalPosition.between(nil, p1)
        #expect(p0 < p1)

        let p2 = FractionalPosition.between(p1, nil)
        #expect(p2 > p1)

        let pMid = FractionalPosition.between(p1, p2)
        #expect(pMid > p1 && pMid < p2)
    }
}
