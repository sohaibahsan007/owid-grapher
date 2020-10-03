import * as React from "react"
import {
    reverse,
    clone,
    last,
    pointsToPath,
    getRelativeMouse,
    makeSafeForCSS,
    minBy,
} from "grapher/utils/Util"
import { computed, action, observable } from "mobx"
import { scaleOrdinal } from "d3-scale"
import { Time, SeriesStrategy, SeriesName } from "grapher/core/GrapherConstants"
import { ColorSchemes, ColorScheme } from "grapher/color/ColorSchemes"
import { observer } from "mobx-react"
import { DualAxisComponent } from "grapher/axis/AxisViews"
import { DualAxis } from "grapher/axis/Axis"
import {
    LineLabelMark,
    LineLegend,
    LineLegendManager,
} from "grapher/lineLegend/LineLegend"
import { NoDataModal } from "grapher/chart/NoDataModal"
import { Tooltip } from "grapher/tooltip/Tooltip"
import { select } from "d3-selection"
import { easeLinear } from "d3-ease"
import { rgb } from "d3-color"
import { EntityName } from "coreTable/CoreTableConstants"
import {
    AbstactStackedChart,
    AbstactStackedChartProps,
} from "grapher/barCharts/AbstractStackedChart"
import { StackedSeries } from "grapher/barCharts/StackedConstants"

interface AreasProps extends React.SVGAttributes<SVGGElement> {
    dualAxis: DualAxis
    seriesArr: StackedSeries[]
    focusedSeriesNames: SeriesName[]
    onHover: (hoverIndex: number | undefined) => void
}

const BLUR_COLOR = "#ddd"

@observer
class Areas extends React.Component<AreasProps> {
    base: React.RefObject<SVGGElement> = React.createRef()

    @observable hoverIndex?: number

    @action.bound private onCursorMove(
        ev: React.MouseEvent<SVGGElement> | React.TouchEvent<SVGElement>
    ) {
        const { dualAxis, seriesArr } = this.props

        const mouse = getRelativeMouse(this.base.current, ev.nativeEvent)

        if (dualAxis.innerBounds.contains(mouse)) {
            const closestPoint = minBy(seriesArr[0].points, (d) =>
                Math.abs(dualAxis.horizontalAxis.place(d.x) - mouse.x)
            )
            if (closestPoint) {
                const index = seriesArr[0].points.indexOf(closestPoint)
                this.hoverIndex = index
            } else {
                this.hoverIndex = undefined
            }
        } else {
            this.hoverIndex = undefined
        }

        this.props.onHover(this.hoverIndex)
    }

    @action.bound private onCursorLeave() {
        this.hoverIndex = undefined
        this.props.onHover(this.hoverIndex)
    }

    private seriesIsBlur(series: StackedSeries) {
        return (
            this.props.focusedSeriesNames.length > 0 &&
            !this.props.focusedSeriesNames.includes(series.seriesName)
        )
    }

    @computed private get areas(): JSX.Element[] {
        const { dualAxis, seriesArr } = this.props
        const { horizontalAxis, verticalAxis } = dualAxis
        const xBottomLeft = [horizontalAxis.range[0], verticalAxis.range[0]]
        const xBottomRight = [horizontalAxis.range[1], verticalAxis.range[0]]

        // Stacked area chart stacks each series upon the previous series, so we must keep track of the last point set we used
        let prevPoints = [xBottomLeft, xBottomRight]
        return seriesArr.map((series) => {
            const mainPoints = series.points.map(
                (point) =>
                    [
                        horizontalAxis.place(point.x),
                        verticalAxis.place(point.y + point.yOffset),
                    ] as [number, number]
            )
            const points = mainPoints.concat(reverse(clone(prevPoints)) as any)
            prevPoints = mainPoints

            return (
                <path
                    className={makeSafeForCSS(series.seriesName) + "-area"}
                    key={series.seriesName + "-area"}
                    strokeLinecap="round"
                    d={pointsToPath(points)}
                    fill={this.seriesIsBlur(series) ? BLUR_COLOR : series.color}
                    fillOpacity={0.7}
                    clipPath={this.props.clipPath}
                />
            )
        })
    }

    @computed private get borders(): JSX.Element[] {
        const { dualAxis, seriesArr } = this.props
        const { horizontalAxis, verticalAxis } = dualAxis

        // Stacked area chart stacks each series upon the previous series, so we must keep track of the last point set we used
        return seriesArr.map((series) => {
            const points = series.points.map(
                (point) =>
                    [
                        horizontalAxis.place(point.x),
                        verticalAxis.place(point.y + point.yOffset),
                    ] as [number, number]
            )

            return (
                <path
                    className={makeSafeForCSS(series.seriesName) + "-border"}
                    key={series.seriesName + "-border"}
                    strokeLinecap="round"
                    d={pointsToPath(points)}
                    stroke={rgb(
                        this.seriesIsBlur(series) ? BLUR_COLOR : series.color
                    )
                        .darker(0.5)
                        .toString()}
                    strokeOpacity={0.7}
                    strokeWidth={0.5}
                    fill="none"
                    clipPath={this.props.clipPath}
                />
            )
        })
    }

    render() {
        const { dualAxis, seriesArr } = this.props
        const { horizontalAxis, verticalAxis } = dualAxis
        const { hoverIndex } = this

        return (
            <g
                ref={this.base}
                className="Areas"
                onMouseMove={this.onCursorMove}
                onMouseLeave={this.onCursorLeave}
                onTouchStart={this.onCursorMove}
                onTouchMove={this.onCursorMove}
                onTouchEnd={this.onCursorLeave}
                onTouchCancel={this.onCursorLeave}
            >
                <rect
                    x={horizontalAxis.range[0]}
                    y={verticalAxis.range[1]}
                    width={horizontalAxis.range[1] - horizontalAxis.range[0]}
                    height={verticalAxis.range[0] - verticalAxis.range[1]}
                    opacity={0}
                    fill="rgba(255,255,255,0)"
                />
                {this.areas}
                {this.borders}
                {hoverIndex !== undefined && (
                    <g className="hoverIndicator">
                        {seriesArr.map((series) => {
                            const point = series.points[hoverIndex]
                            return this.seriesIsBlur(series) ? null : (
                                <circle
                                    key={series.seriesName}
                                    cx={horizontalAxis.place(point.x)}
                                    cy={verticalAxis.place(
                                        point.y + point.yOffset
                                    )}
                                    r={2}
                                    fill={series.color}
                                />
                            )
                        })}
                        <line
                            x1={horizontalAxis.place(
                                seriesArr[0].points[hoverIndex].x
                            )}
                            y1={verticalAxis.range[0]}
                            x2={horizontalAxis.place(
                                seriesArr[0].points[hoverIndex].x
                            )}
                            y2={verticalAxis.range[1]}
                            stroke="rgba(180,180,180,.4)"
                        />
                    </g>
                )}
            </g>
        )
    }
}

@observer
export class StackedAreaChart
    extends AbstactStackedChart
    implements LineLegendManager {
    base: React.RefObject<SVGGElement> = React.createRef()

    constructor(props: AbstactStackedChartProps) {
        super(props)
    }

    @computed get verticalAxis() {
        return this.dualAxis.verticalAxis
    }

    @computed get midpoints() {
        let prevY = 0
        return this.series.map((series) => {
            const lastValue = last(series.points)
            if (!lastValue) return 0

            const y = lastValue.y + lastValue.yOffset
            const middleY = prevY + (y - prevY) / 2
            prevY = y
            return middleY
        })
    }

    @computed get labelMarks(): LineLabelMark[] {
        const { midpoints } = this
        return this.series
            .map((series, index) => ({
                color: series.color,
                seriesName: series.seriesName,
                label: this.manager.table.getLabelForEntityName(
                    series.seriesName
                ),
                yValue: midpoints[index],
            }))
            .reverse()
    }

    @computed get maxLegendWidth() {
        return Math.min(150, this.bounds.width / 3)
    }

    @computed get legendDimensions(): LineLegend | undefined {
        if (this.manager.hideLegend) return undefined
        return new LineLegend({ manager: this })
    }

    @observable hoverIndex?: number
    @action.bound onHover(hoverIndex: number | undefined) {
        this.hoverIndex = hoverIndex
    }

    @observable hoverKey?: string
    @action.bound onLegendClick() {
        if (this.manager.showAddEntityControls)
            this.manager.isSelectingData = true
    }

    @computed protected get paddingForLegend() {
        const { legendDimensions } = this
        return legendDimensions ? legendDimensions.width : 20
    }

    @action.bound onLegendMouseOver(key: EntityName) {
        this.hoverKey = key
    }

    @action.bound onLegendMouseLeave() {
        this.hoverKey = undefined
    }

    @computed get focusedSeriesNames() {
        return this.hoverKey ? [this.hoverKey] : []
    }

    @computed get isFocusMode() {
        return this.focusedSeriesNames.length > 0
    }

    seriesIsBlur(series: StackedSeries) {
        return (
            this.focusedSeriesNames.length > 0 &&
            !this.focusedSeriesNames.includes(series.seriesName)
        )
    }

    @computed private get tooltip() {
        if (this.hoverIndex === undefined) return undefined

        const { hoverIndex, dualAxis, manager, series } = this

        // Grab the first value to get the year from
        const refValue = series[0].points[hoverIndex]

        // If some data is missing, don't calculate a total
        const someMissing = series.some(
            (g) => g.points[hoverIndex] === undefined
        )

        const legendBlockStyle = {
            width: "10px",
            height: "10px",
            display: "inline-block",
            marginRight: "2px",
        }

        return (
            <Tooltip
                tooltipManager={this.props.manager}
                x={dualAxis.horizontalAxis.place(refValue.x)}
                y={
                    dualAxis.verticalAxis.rangeMin +
                    dualAxis.verticalAxis.rangeSize / 2
                }
                style={{ padding: "0.3em" }}
                offsetX={5}
            >
                <table style={{ fontSize: "0.9em", lineHeight: "1.4em" }}>
                    <tbody>
                        <tr>
                            <td>
                                <strong>
                                    {this.manager.table.timeColumnFormatFunction(
                                        refValue.x
                                    )}
                                </strong>
                            </td>
                            <td></td>
                        </tr>
                        {reverse(clone(series)).map((series) => {
                            const value = series.points[hoverIndex]
                            const isBlur = this.seriesIsBlur(series)
                            const textColor = isBlur ? "#ddd" : "#333"
                            const blockColor = isBlur
                                ? BLUR_COLOR
                                : series.color
                            return (
                                <tr
                                    key={series.seriesName}
                                    style={{ color: textColor }}
                                >
                                    <td
                                        style={{
                                            paddingRight: "0.8em",
                                            fontSize: "0.9em",
                                        }}
                                    >
                                        <div
                                            style={{
                                                ...legendBlockStyle,
                                                backgroundColor: blockColor,
                                            }}
                                        />{" "}
                                        {manager.table.getLabelForEntityName(
                                            series.seriesName
                                        )}
                                    </td>
                                    <td style={{ textAlign: "right" }}>
                                        {value.y === undefined
                                            ? "No data"
                                            : this.formatYTick(value.y)}
                                    </td>
                                </tr>
                            )
                        })}
                        {/* Total */}
                        {!someMissing && (
                            <tr>
                                <td style={{ fontSize: "0.9em" }}>
                                    <div
                                        style={{
                                            ...legendBlockStyle,
                                            backgroundColor: "transparent",
                                        }}
                                    />{" "}
                                    <strong>Total</strong>
                                </td>
                                <td style={{ textAlign: "right" }}>
                                    <span>
                                        <strong>
                                            {this.formatYTick(
                                                series[series.length - 1]
                                                    .points[hoverIndex].y
                                            )}
                                        </strong>
                                    </span>
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </Tooltip>
        )
    }

    animSelection?: d3.Selection<
        d3.BaseType,
        unknown,
        SVGGElement | null,
        unknown
    >

    componentDidMount() {
        // Fancy intro animation

        this.animSelection = select(this.base.current)
            .selectAll("clipPath > rect")
            .attr("width", 0)

        this.animSelection
            .transition()
            .duration(800)
            .ease(easeLinear)
            .attr("width", this.bounds.width)
            .on("end", () => this.forceUpdate()) // Important in case bounds changes during transition
    }

    componentWillUnmount() {
        if (this.animSelection) this.animSelection.interrupt()
    }

    render() {
        if (this.failMessage)
            return (
                <NoDataModal
                    manager={this.manager}
                    bounds={this.props.bounds}
                    message={this.failMessage}
                />
            )

        const { manager, bounds, dualAxis, renderUid, series } = this

        const showLegend = !this.manager.hideLegend

        return (
            <g ref={this.base} className="StackedArea">
                <defs>
                    <clipPath id={`boundsClip-${renderUid}`}>
                        <rect
                            x={dualAxis.innerBounds.x}
                            y={bounds.y}
                            width={bounds.width}
                            height={bounds.height * 2}
                        ></rect>
                    </clipPath>
                </defs>
                <DualAxisComponent
                    isInteractive={manager.isInteractive}
                    dualAxis={dualAxis}
                    showTickMarks={true}
                />
                <g clipPath={`url(#boundsClip-${renderUid})`}>
                    {showLegend && <LineLegend manager={this} />}
                    <Areas
                        dualAxis={dualAxis}
                        seriesArr={series}
                        focusedSeriesNames={this.focusedSeriesNames}
                        onHover={this.onHover}
                    />
                </g>
                {this.tooltip}
            </g>
        )
    }

    @computed get legendX(): number {
        return this.legendDimensions
            ? this.bounds.right - this.legendDimensions.width
            : 0
    }

    @computed get availableTimes(): Time[] {
        // Since we've already aligned the data, the years of any series corresponds to the years of all of them
        return this.series[0]?.points.map((v) => v.x) || []
    }

    @computed private get colorScheme() {
        //return ["#9e0142","#d53e4f","#f46d43","#fdae61","#fee08b","#ffffbf","#e6f598","#abdda4","#66c2a5","#3288bd","#5e4fa2"]
        const colorScheme = ColorSchemes[this.manager.baseColorScheme as string]
        return colorScheme !== undefined
            ? colorScheme
            : (ColorSchemes["stackedAreaDefault"] as ColorScheme)
    }

    @computed get colorScale() {
        const seriesCount =
            this.seriesStrategy === SeriesStrategy.entity
                ? this.table.selectedEntityNames.length
                : this.yColumns.length
        const baseColors = this.colorScheme.getColors(seriesCount)
        if (this.manager.invertColorScheme) baseColors.reverse()
        return scaleOrdinal(baseColors)
    }

    getColorForSeries(seriesName: SeriesName) {
        return (
            this.table.getColorForEntityName(seriesName) ||
            this.colorScale(seriesName)
        )
    }

    // Todo: readd this behavior with tests. We need to support missing points. Probably do it at the table level
    // // Get the data for each stacked area series, cleaned to ensure every series
    // // "lines up" i.e. has a data point for every year
    //     // Now ensure that every series has a value entry for every year in the data
    //     let allYears: number[] = []
    //     groupedData.forEach((series) =>
    //         allYears.push(...series.points.map((d) => d.x))
    //     )
    //     allYears = sortNumeric(uniq(allYears))

    //     groupedData.forEach((series) => {
    //         let i = 0
    //         let isBeforeStart = true

    //         while (i < allYears.length) {
    //             const value = series.points[i] as StackedAreaPoint | undefined
    //             const expectedYear = allYears[i]

    //             if (value === undefined || value.x > allYears[i]) {
    //                 let fakeY = NaN

    //                 if (!isBeforeStart && i < series.points.length) {
    //                     // Missing data in the middle-- interpolate a value
    //                     const prevValue = series.points[i - 1]
    //                     const nextValue = series.points[i]
    //                     fakeY = (nextValue.y + prevValue.y) / 2
    //                 }

    //                 series.points.splice(i, 0, {
    //                     x: expectedYear,
    //                     y: fakeY,
    //                     time: expectedYear,
    //                     isFake: true,
    //                 })
    //             } else {
    //                 isBeforeStart = false
    //             }
    //             i += 1
    //         }
    //     })

    //     // Strip years at start and end where we couldn't successfully interpolate
    //     for (const firstSeries of groupedData.slice(0, 1)) {
    //         for (let i = firstSeries.points.length - 1; i >= 0; i--) {
    //             if (groupedData.some((series) => isNaN(series.points[i].y))) {
    //                 for (const series of groupedData) {
    //                     series.points.splice(i, 1)
    //                 }
    //             }
    //         }
    //     }
    // }
    private formatYTick(v: number) {
        const yColumn = this.yColumns[0]
        return yColumn ? yColumn.formatValueShort(v) : v // todo: restore { noTrailingZeroes: false }
    }
}
