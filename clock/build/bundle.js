
(function(l, r) { if (l.getElementById('livereloadscript')) return; r = l.createElement('script'); r.async = 1; r.src = '//' + (window.location.host || 'localhost').split(':')[0] + ':35729/livereload.js?snipver=1'; r.id = 'livereloadscript'; l.getElementsByTagName('head')[0].appendChild(r) })(window.document);
var app = (function () {
    'use strict';

    function noop() { }
    function add_location(element, file, line, column, char) {
        element.__svelte_meta = {
            loc: { file, line, column, char }
        };
    }
    function run(fn) {
        return fn();
    }
    function blank_object() {
        return Object.create(null);
    }
    function run_all(fns) {
        fns.forEach(run);
    }
    function is_function(thing) {
        return typeof thing === 'function';
    }
    function safe_not_equal(a, b) {
        return a != a ? b == b : a !== b || ((a && typeof a === 'object') || typeof a === 'function');
    }

    function append(target, node) {
        target.appendChild(node);
    }
    function insert(target, node, anchor) {
        target.insertBefore(node, anchor || null);
    }
    function detach(node) {
        node.parentNode.removeChild(node);
    }
    function destroy_each(iterations, detaching) {
        for (let i = 0; i < iterations.length; i += 1) {
            if (iterations[i])
                iterations[i].d(detaching);
        }
    }
    function element(name) {
        return document.createElement(name);
    }
    function text(data) {
        return document.createTextNode(data);
    }
    function space() {
        return text(' ');
    }
    function attr(node, attribute, value) {
        if (value == null)
            node.removeAttribute(attribute);
        else if (node.getAttribute(attribute) !== value)
            node.setAttribute(attribute, value);
    }
    function children(element) {
        return Array.from(element.childNodes);
    }
    function custom_event(type, detail) {
        const e = document.createEvent('CustomEvent');
        e.initCustomEvent(type, false, false, detail);
        return e;
    }

    let current_component;
    function set_current_component(component) {
        current_component = component;
    }
    function get_current_component() {
        if (!current_component)
            throw new Error(`Function called outside component initialization`);
        return current_component;
    }
    function onMount(fn) {
        get_current_component().$$.on_mount.push(fn);
    }

    const dirty_components = [];
    const binding_callbacks = [];
    const render_callbacks = [];
    const flush_callbacks = [];
    const resolved_promise = Promise.resolve();
    let update_scheduled = false;
    function schedule_update() {
        if (!update_scheduled) {
            update_scheduled = true;
            resolved_promise.then(flush);
        }
    }
    function add_render_callback(fn) {
        render_callbacks.push(fn);
    }
    let flushing = false;
    const seen_callbacks = new Set();
    function flush() {
        if (flushing)
            return;
        flushing = true;
        do {
            // first, call beforeUpdate functions
            // and update components
            for (let i = 0; i < dirty_components.length; i += 1) {
                const component = dirty_components[i];
                set_current_component(component);
                update(component.$$);
            }
            dirty_components.length = 0;
            while (binding_callbacks.length)
                binding_callbacks.pop()();
            // then, once components are updated, call
            // afterUpdate functions. This may cause
            // subsequent updates...
            for (let i = 0; i < render_callbacks.length; i += 1) {
                const callback = render_callbacks[i];
                if (!seen_callbacks.has(callback)) {
                    // ...so guard against infinite loops
                    seen_callbacks.add(callback);
                    callback();
                }
            }
            render_callbacks.length = 0;
        } while (dirty_components.length);
        while (flush_callbacks.length) {
            flush_callbacks.pop()();
        }
        update_scheduled = false;
        flushing = false;
        seen_callbacks.clear();
    }
    function update($$) {
        if ($$.fragment !== null) {
            $$.update();
            run_all($$.before_update);
            const dirty = $$.dirty;
            $$.dirty = [-1];
            $$.fragment && $$.fragment.p($$.ctx, dirty);
            $$.after_update.forEach(add_render_callback);
        }
    }
    const outroing = new Set();
    let outros;
    function group_outros() {
        outros = {
            r: 0,
            c: [],
            p: outros // parent group
        };
    }
    function check_outros() {
        if (!outros.r) {
            run_all(outros.c);
        }
        outros = outros.p;
    }
    function transition_in(block, local) {
        if (block && block.i) {
            outroing.delete(block);
            block.i(local);
        }
    }
    function transition_out(block, local, detach, callback) {
        if (block && block.o) {
            if (outroing.has(block))
                return;
            outroing.add(block);
            outros.c.push(() => {
                outroing.delete(block);
                if (callback) {
                    if (detach)
                        block.d(1);
                    callback();
                }
            });
            block.o(local);
        }
    }
    function create_component(block) {
        block && block.c();
    }
    function mount_component(component, target, anchor) {
        const { fragment, on_mount, on_destroy, after_update } = component.$$;
        fragment && fragment.m(target, anchor);
        // onMount happens before the initial afterUpdate
        add_render_callback(() => {
            const new_on_destroy = on_mount.map(run).filter(is_function);
            if (on_destroy) {
                on_destroy.push(...new_on_destroy);
            }
            else {
                // Edge case - component was destroyed immediately,
                // most likely as a result of a binding initialising
                run_all(new_on_destroy);
            }
            component.$$.on_mount = [];
        });
        after_update.forEach(add_render_callback);
    }
    function destroy_component(component, detaching) {
        const $$ = component.$$;
        if ($$.fragment !== null) {
            run_all($$.on_destroy);
            $$.fragment && $$.fragment.d(detaching);
            // TODO null out other refs, including component.$$ (but need to
            // preserve final state?)
            $$.on_destroy = $$.fragment = null;
            $$.ctx = [];
        }
    }
    function make_dirty(component, i) {
        if (component.$$.dirty[0] === -1) {
            dirty_components.push(component);
            schedule_update();
            component.$$.dirty.fill(0);
        }
        component.$$.dirty[(i / 31) | 0] |= (1 << (i % 31));
    }
    function init(component, options, instance, create_fragment, not_equal, props, dirty = [-1]) {
        const parent_component = current_component;
        set_current_component(component);
        const prop_values = options.props || {};
        const $$ = component.$$ = {
            fragment: null,
            ctx: null,
            // state
            props,
            update: noop,
            not_equal,
            bound: blank_object(),
            // lifecycle
            on_mount: [],
            on_destroy: [],
            before_update: [],
            after_update: [],
            context: new Map(parent_component ? parent_component.$$.context : []),
            // everything else
            callbacks: blank_object(),
            dirty
        };
        let ready = false;
        $$.ctx = instance
            ? instance(component, prop_values, (i, ret, ...rest) => {
                const value = rest.length ? rest[0] : ret;
                if ($$.ctx && not_equal($$.ctx[i], $$.ctx[i] = value)) {
                    if ($$.bound[i])
                        $$.bound[i](value);
                    if (ready)
                        make_dirty(component, i);
                }
                return ret;
            })
            : [];
        $$.update();
        ready = true;
        run_all($$.before_update);
        // `false` as a special case of no DOM component
        $$.fragment = create_fragment ? create_fragment($$.ctx) : false;
        if (options.target) {
            if (options.hydrate) {
                const nodes = children(options.target);
                // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                $$.fragment && $$.fragment.l(nodes);
                nodes.forEach(detach);
            }
            else {
                // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                $$.fragment && $$.fragment.c();
            }
            if (options.intro)
                transition_in(component.$$.fragment);
            mount_component(component, options.target, options.anchor);
            flush();
        }
        set_current_component(parent_component);
    }
    class SvelteComponent {
        $destroy() {
            destroy_component(this, 1);
            this.$destroy = noop;
        }
        $on(type, callback) {
            const callbacks = (this.$$.callbacks[type] || (this.$$.callbacks[type] = []));
            callbacks.push(callback);
            return () => {
                const index = callbacks.indexOf(callback);
                if (index !== -1)
                    callbacks.splice(index, 1);
            };
        }
        $set() {
            // overridden by instance, if it has props
        }
    }

    function dispatch_dev(type, detail) {
        document.dispatchEvent(custom_event(type, Object.assign({ version: '3.23.2' }, detail)));
    }
    function append_dev(target, node) {
        dispatch_dev("SvelteDOMInsert", { target, node });
        append(target, node);
    }
    function insert_dev(target, node, anchor) {
        dispatch_dev("SvelteDOMInsert", { target, node, anchor });
        insert(target, node, anchor);
    }
    function detach_dev(node) {
        dispatch_dev("SvelteDOMRemove", { node });
        detach(node);
    }
    function attr_dev(node, attribute, value) {
        attr(node, attribute, value);
        if (value == null)
            dispatch_dev("SvelteDOMRemoveAttribute", { node, attribute });
        else
            dispatch_dev("SvelteDOMSetAttribute", { node, attribute, value });
    }
    function set_data_dev(text, data) {
        data = '' + data;
        if (text.data === data)
            return;
        dispatch_dev("SvelteDOMSetData", { node: text, data });
        text.data = data;
    }
    function validate_each_argument(arg) {
        if (typeof arg !== 'string' && !(arg && typeof arg === 'object' && 'length' in arg)) {
            let msg = '{#each} only iterates over array-like objects.';
            if (typeof Symbol === 'function' && arg && Symbol.iterator in arg) {
                msg += ' You can use a spread to convert this iterable into an array.';
            }
            throw new Error(msg);
        }
    }
    function validate_slots(name, slot, keys) {
        for (const slot_key of Object.keys(slot)) {
            if (!~keys.indexOf(slot_key)) {
                console.warn(`<${name}> received an unexpected slot "${slot_key}".`);
            }
        }
    }
    class SvelteComponentDev extends SvelteComponent {
        constructor(options) {
            if (!options || (!options.target && !options.$$inline)) {
                throw new Error(`'target' is a required option`);
            }
            super();
        }
        $destroy() {
            super.$destroy();
            this.$destroy = () => {
                console.warn(`Component was already destroyed`); // eslint-disable-line no-console
            };
        }
        $capture_state() { }
        $inject_state() { }
    }

    /* src/components/Clock.svelte generated by Svelte v3.23.2 */
    const file = "src/components/Clock.svelte";

    function create_fragment(ctx) {
    	let div;

    	const block = {
    		c: function create() {
    			div = element("div");
    			attr_dev(div, "class", "clock-chart");
    			attr_dev(div, "id", /*clockid*/ ctx[0]);
    			add_location(div, file, 123, 0, 3079);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div, anchor);
    		},
    		p: function update(ctx, [dirty]) {
    			if (dirty & /*clockid*/ 1) {
    				attr_dev(div, "id", /*clockid*/ ctx[0]);
    			}
    		},
    		i: noop,
    		o: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance($$self, $$props, $$invalidate) {
    	let { clockid = "clock-id" } = $$props;
    	let { dt = new Date("2000-01-01T00:00:00") } = $$props;
    	let { dateRandom = false } = $$props;

    	const getRandomInt = (min, max) => {
    		min = Math.ceil(min);
    		max = Math.floor(max);
    		return Math.floor(Math.random() * (max - min)) + min; //The maximum is exclusive and the minimum is inclusive
    	};

    	if (dateRandom) {
    		const ranHour = ("00" + getRandomInt(0, 12).toString()).slice(-2);
    		const ranMin = ("00" + getRandomInt(0, 60).toString()).slice(-2);
    		dt = new Date(`2000-01-01T${ranHour}:${ranMin}:00`);
    	}

    	onMount(() => {
    		const width = 300;
    		const height = 300;
    		const r = Math.min(width, height) / 2;
    		const secMinScale = d3.scaleLinear().domain([0, 60]).range([0, 360]);
    		const hourScale = d3.scaleLinear().domain([0, 12]).range([0, 360]);

    		const pointersRelDimensions = [
    			{ class: "hour", width: 0.06, height: 0.55 },
    			{ class: "min", width: 0.05, height: 0.85 },
    			{ class: "sec", width: 0.02, height: 0.85 }
    		];

    		const svg = d3.select(`#${clockid}`).append("svg").attr("viewBox", `${-r} ${-r} ${r * 2} ${r * 2}`).attr("preserveAspectRatio", "xMidYMid");
    		svg.append("circle").classed("background", true).attr("cx", 0).attr("cy", 0).attr("r", r);
    		svg.append("g").classed("axis", true).call(d3.axisRadialInner(hourScale.copy().range([0, 2 * Math.PI]), r - 1).ticks(12).tickSize(12));
    		svg.append("g").classed("minor-ticks", true).call(d3.axisRadialInner(secMinScale.copy().range([0, 2 * Math.PI]), r - 1).ticks(60).tickSize(6));
    		svg.append("g").classed("pointers", true).attr("transform", `scale(${r})`).selectAll("rect").data(pointersRelDimensions).enter().append("rect").attr("class", d => d.class).attr("x", d => -d.width / 2).attr("y", d => -d.height + d.width / 2).attr("width", d => d.width).attr("height", d => d.height).attr("rx", 0.02).attr("ry", 0.03);
    		svg.select(".pointers").append("circle").classed("center", true).attr("x", width / 2).attr("y", height / 2).attr("r", 0.05);

    		const setTime = dt => {
    			const ms = dt.getMilliseconds(),
    				secs = dt.getSeconds() + ms / 1000,
    				mins = dt.getMinutes() + secs / 60,
    				hours = dt.getHours() % 12 + mins / 60;

    			d3.select(`#${clockid} .pointers .hour`).attr("transform", `rotate(${hourScale(hours)})`);
    			d3.select(`#${clockid} .pointers .min`).attr("transform", `rotate(${secMinScale(mins)})`);
    			d3.select(`#${clockid} .pointers .sec`).attr("transform", `rotate(${secMinScale(secs)})`);
    		};

    		setTime(dt);
    	});

    	const writable_props = ["clockid", "dt", "dateRandom"];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== "$$") console.warn(`<Clock> was created with unknown prop '${key}'`);
    	});

    	let { $$slots = {}, $$scope } = $$props;
    	validate_slots("Clock", $$slots, []);

    	$$self.$set = $$props => {
    		if ("clockid" in $$props) $$invalidate(0, clockid = $$props.clockid);
    		if ("dt" in $$props) $$invalidate(1, dt = $$props.dt);
    		if ("dateRandom" in $$props) $$invalidate(2, dateRandom = $$props.dateRandom);
    	};

    	$$self.$capture_state = () => ({
    		onMount,
    		clockid,
    		dt,
    		dateRandom,
    		getRandomInt
    	});

    	$$self.$inject_state = $$props => {
    		if ("clockid" in $$props) $$invalidate(0, clockid = $$props.clockid);
    		if ("dt" in $$props) $$invalidate(1, dt = $$props.dt);
    		if ("dateRandom" in $$props) $$invalidate(2, dateRandom = $$props.dateRandom);
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	return [clockid, dt, dateRandom];
    }

    class Clock extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance, create_fragment, safe_not_equal, { clockid: 0, dt: 1, dateRandom: 2 });

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "Clock",
    			options,
    			id: create_fragment.name
    		});
    	}

    	get clockid() {
    		throw new Error("<Clock>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set clockid(value) {
    		throw new Error("<Clock>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get dt() {
    		throw new Error("<Clock>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set dt(value) {
    		throw new Error("<Clock>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get dateRandom() {
    		throw new Error("<Clock>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set dateRandom(value) {
    		throw new Error("<Clock>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}
    }

    /* src/ClockCard.svelte generated by Svelte v3.23.2 */
    const file$1 = "src/ClockCard.svelte";

    function create_fragment$1(ctx) {
    	let div4;
    	let div3;
    	let div1;
    	let div0;
    	let t0;
    	let t1;
    	let clock;
    	let t2;
    	let div2;
    	let input;
    	let current;

    	clock = new Clock({
    			props: {
    				clockid: `clock-${/*idx*/ ctx[0]}`,
    				dateRandom: true
    			},
    			$$inline: true
    		});

    	const block = {
    		c: function create() {
    			div4 = element("div");
    			div3 = element("div");
    			div1 = element("div");
    			div0 = element("div");
    			t0 = text(/*idx*/ ctx[0]);
    			t1 = space();
    			create_component(clock.$$.fragment);
    			t2 = space();
    			div2 = element("div");
    			input = element("input");
    			attr_dev(div0, "class", "card-title svelte-1av6w0t");
    			add_location(div0, file$1, 15, 6, 235);
    			attr_dev(div1, "class", "card-content");
    			add_location(div1, file$1, 14, 4, 202);
    			attr_dev(input, "type", "text");
    			input.value = "";
    			add_location(input, file$1, 19, 6, 370);
    			attr_dev(div2, "class", "card-action");
    			add_location(div2, file$1, 18, 4, 338);
    			attr_dev(div3, "class", "card");
    			add_location(div3, file$1, 13, 2, 179);
    			attr_dev(div4, "class", "col s3 m3 l3");
    			add_location(div4, file$1, 12, 0, 150);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div4, anchor);
    			append_dev(div4, div3);
    			append_dev(div3, div1);
    			append_dev(div1, div0);
    			append_dev(div0, t0);
    			append_dev(div1, t1);
    			mount_component(clock, div1, null);
    			append_dev(div3, t2);
    			append_dev(div3, div2);
    			append_dev(div2, input);
    			current = true;
    		},
    		p: function update(ctx, [dirty]) {
    			if (!current || dirty & /*idx*/ 1) set_data_dev(t0, /*idx*/ ctx[0]);
    			const clock_changes = {};
    			if (dirty & /*idx*/ 1) clock_changes.clockid = `clock-${/*idx*/ ctx[0]}`;
    			clock.$set(clock_changes);
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(clock.$$.fragment, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(clock.$$.fragment, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div4);
    			destroy_component(clock);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$1.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance$1($$self, $$props, $$invalidate) {
    	let { idx = 0 } = $$props;
    	const writable_props = ["idx"];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== "$$") console.warn(`<ClockCard> was created with unknown prop '${key}'`);
    	});

    	let { $$slots = {}, $$scope } = $$props;
    	validate_slots("ClockCard", $$slots, []);

    	$$self.$set = $$props => {
    		if ("idx" in $$props) $$invalidate(0, idx = $$props.idx);
    	};

    	$$self.$capture_state = () => ({ Clock, idx });

    	$$self.$inject_state = $$props => {
    		if ("idx" in $$props) $$invalidate(0, idx = $$props.idx);
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	return [idx];
    }

    class ClockCard extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$1, create_fragment$1, safe_not_equal, { idx: 0 });

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "ClockCard",
    			options,
    			id: create_fragment$1.name
    		});
    	}

    	get idx() {
    		throw new Error("<ClockCard>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set idx(value) {
    		throw new Error("<ClockCard>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}
    }

    /* src/App.svelte generated by Svelte v3.23.2 */
    const file$2 = "src/App.svelte";

    function get_each_context(ctx, list, i) {
    	const child_ctx = ctx.slice();
    	child_ctx[1] = list[i];
    	return child_ctx;
    }

    // (34:6) {#each cardList as idx}
    function create_each_block(ctx) {
    	let clockcard;
    	let current;

    	clockcard = new ClockCard({
    			props: { idx: /*idx*/ ctx[1] },
    			$$inline: true
    		});

    	const block = {
    		c: function create() {
    			create_component(clockcard.$$.fragment);
    		},
    		m: function mount(target, anchor) {
    			mount_component(clockcard, target, anchor);
    			current = true;
    		},
    		p: noop,
    		i: function intro(local) {
    			if (current) return;
    			transition_in(clockcard.$$.fragment, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(clockcard.$$.fragment, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			destroy_component(clockcard, detaching);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_each_block.name,
    		type: "each",
    		source: "(34:6) {#each cardList as idx}",
    		ctx
    	});

    	return block;
    }

    function create_fragment$2(ctx) {
    	let main;
    	let div4;
    	let div3;
    	let div0;
    	let input0;
    	let t0;
    	let div1;
    	let input1;
    	let t1;
    	let div2;
    	let input2;
    	let t2;
    	let current;
    	let each_value = /*cardList*/ ctx[0];
    	validate_each_argument(each_value);
    	let each_blocks = [];

    	for (let i = 0; i < each_value.length; i += 1) {
    		each_blocks[i] = create_each_block(get_each_context(ctx, each_value, i));
    	}

    	const out = i => transition_out(each_blocks[i], 1, 1, () => {
    		each_blocks[i] = null;
    	});

    	const block = {
    		c: function create() {
    			main = element("main");
    			div4 = element("div");
    			div3 = element("div");
    			div0 = element("div");
    			input0 = element("input");
    			t0 = space();
    			div1 = element("div");
    			input1 = element("input");
    			t1 = space();
    			div2 = element("div");
    			input2 = element("input");
    			t2 = space();

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].c();
    			}

    			attr_dev(input0, "type", "text");
    			input0.value = "日付";
    			add_location(input0, file$2, 25, 8, 432);
    			attr_dev(div0, "class", "col s4 s4 s4");
    			add_location(div0, file$2, 24, 6, 397);
    			attr_dev(input1, "type", "text");
    			input1.value = "名前";
    			add_location(input1, file$2, 28, 8, 519);
    			attr_dev(div1, "class", "col s6 s6 s6");
    			add_location(div1, file$2, 27, 6, 484);
    			attr_dev(input2, "type", "text");
    			input2.value = "点";
    			add_location(input2, file$2, 31, 8, 606);
    			attr_dev(div2, "class", "col s2 s2 s2");
    			add_location(div2, file$2, 30, 6, 571);
    			attr_dev(div3, "class", "row");
    			add_location(div3, file$2, 22, 4, 357);
    			attr_dev(div4, "class", "container");
    			add_location(div4, file$2, 21, 2, 329);
    			attr_dev(main, "class", "svelte-l1p4r0");
    			add_location(main, file$2, 20, 0, 320);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, main, anchor);
    			append_dev(main, div4);
    			append_dev(div4, div3);
    			append_dev(div3, div0);
    			append_dev(div0, input0);
    			append_dev(div3, t0);
    			append_dev(div3, div1);
    			append_dev(div1, input1);
    			append_dev(div3, t1);
    			append_dev(div3, div2);
    			append_dev(div2, input2);
    			append_dev(div3, t2);

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].m(div3, null);
    			}

    			current = true;
    		},
    		p: function update(ctx, [dirty]) {
    			if (dirty & /*cardList*/ 1) {
    				each_value = /*cardList*/ ctx[0];
    				validate_each_argument(each_value);
    				let i;

    				for (i = 0; i < each_value.length; i += 1) {
    					const child_ctx = get_each_context(ctx, each_value, i);

    					if (each_blocks[i]) {
    						each_blocks[i].p(child_ctx, dirty);
    						transition_in(each_blocks[i], 1);
    					} else {
    						each_blocks[i] = create_each_block(child_ctx);
    						each_blocks[i].c();
    						transition_in(each_blocks[i], 1);
    						each_blocks[i].m(div3, null);
    					}
    				}

    				group_outros();

    				for (i = each_value.length; i < each_blocks.length; i += 1) {
    					out(i);
    				}

    				check_outros();
    			}
    		},
    		i: function intro(local) {
    			if (current) return;

    			for (let i = 0; i < each_value.length; i += 1) {
    				transition_in(each_blocks[i]);
    			}

    			current = true;
    		},
    		o: function outro(local) {
    			each_blocks = each_blocks.filter(Boolean);

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				transition_out(each_blocks[i]);
    			}

    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(main);
    			destroy_each(each_blocks, detaching);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$2.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance$2($$self, $$props, $$invalidate) {
    	const cardList = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
    	const writable_props = [];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== "$$") console.warn(`<App> was created with unknown prop '${key}'`);
    	});

    	let { $$slots = {}, $$scope } = $$props;
    	validate_slots("App", $$slots, []);
    	$$self.$capture_state = () => ({ Clock, ClockCard, cardList });
    	return [cardList];
    }

    class App extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$2, create_fragment$2, safe_not_equal, {});

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "App",
    			options,
    			id: create_fragment$2.name
    		});
    	}
    }

    const app = new App({
      target: document.body,
      props: {},
    });

    return app;

}());
//# sourceMappingURL=bundle.js.map
