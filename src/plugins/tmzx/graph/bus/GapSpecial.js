export default class GapSpecial {
  constructor(bus1, bus2, list) {
    let busSet = (this.busSet = new Set())
    this.bus1 = bus1
    this.bus2 = bus2
    busSet.add(bus1)
    busSet.add(bus2)
    this.list = list
  }
}
