#! /usr/bin/env yarn jest

import { StackedAreaChart } from "./StackedAreaChart"
import { SynthesizeOwidTable } from "coreTable/OwidTable"
import { ChartManager } from "grapher/chart/ChartManager"
import { observable } from "mobx"
import { AxisConfig } from "grapher/axis/AxisConfig"

class MockManager implements ChartManager {
    table = SynthesizeOwidTable({
        timeRange: [1950, 2010],
    })
    yColumnSlugs = ["GDP"]
    yAxis = new AxisConfig({ min: 0, max: 200 })
    @observable isRelativeMode = false
}

describe(StackedAreaChart, () => {
    it("can create a basic chart", () => {
        const manager = new MockManager()
        const chart = new StackedAreaChart({ manager })

        expect(chart.failMessage).toBeTruthy()

        manager.table.selectAll()

        expect(chart.failMessage).toEqual("")
    })

    it("can create a chart and toggle relative mode", () => {
        const manager = new MockManager()
        const chart = new StackedAreaChart({ manager })

        expect(chart.verticalAxis.domain[1]).toBeGreaterThan(100)

        manager.isRelativeMode = true
        expect(chart.verticalAxis.domain).toEqual([0, 100])
    })
})
