const {
  CategoryColorLine,
  ReaderNavigationMenuSearchButton,
  ReaderNavigationMenuCloseButton,
  ReaderNavigationMenuDisplaySettingsButton,
  LoadingMessage,
}                = require('./Misc');
const React      = require('react');
const ReactDOM   = require('react-dom');
const extend     = require('extend');
const $          = require('./sefariaJquery');
const Sefaria    = require('./sefaria');
const classNames = require('classnames');
const PropTypes  = require('prop-types');
const Footer     = require('./Footer');
import Component from 'react-class';

class SearchPage extends Component {
    constructor(props) {
      super(props);
      this.state = {};
    }
    render () {
        var fontSize = 62.5; // this.props.settings.fontSize, to make this respond to user setting. disabled for now.
        var style    = {"fontSize": fontSize + "%"};
        var classes  = classNames({readerNavMenu: 1, noHeader: this.props.hideNavHeader});
        var isQueryHebrew = Sefaria.hebrew.isHebrew(this.props.query);
        return (<div className={classes} key={this.props.query}>
                  {this.props.hideNavHeader ? null :
                    (<div className="readerNavTop search">
                      <CategoryColorLine category="Other" />
                      <ReaderNavigationMenuCloseButton onClick={this.props.close}/>
                      <ReaderNavigationMenuDisplaySettingsButton onClick={this.props.openDisplaySettings} />
                      <SearchBar
                        initialQuery = { this.props.query }
                        updateQuery = { this.props.onQueryChange } />
                    </div>)}
                  <div className="content hasFooter">
                    <div className="contentInner">
                      <div className="searchContentFrame">
                          <h1 className={classNames({"hebrewQuery": isQueryHebrew, "englishQuery": !isQueryHebrew})}>
                            &ldquo;{ this.props.query }&rdquo;
                          </h1>
                          <div className="searchControlsBox">
                          </div>
                          <div className="searchContent" style={style}>
                              <SearchResultList
                                  query = { this.props.query }
                                  appliedFilters = {this.props.appliedFilters}
                                  onResultClick={this.props.onResultClick}
                                  updateAppliedFilter = {this.props.updateAppliedFilter}
                                  updateAppliedOptionField={this.props.updateAppliedOptionField}
                                  updateAppliedOptionSort={this.props.updateAppliedOptionSort}
                                  registerAvailableFilters={this.props.registerAvailableFilters}
                                  availableFilters={this.props.availableFilters}
                                  filtersValid={this.props.filtersValid}
                                  exactField={this.props.exactField}
                                  broadField={this.props.broadField}
                                  field={this.props.field}
                                  sortType={this.props.sortType}/>
                          </div>
                      </div>
                    </div>
                    <footer id="footer" className={`interface-${this.props.interfaceLang} static sans`}>
                      <Footer />
                    </footer>
                  </div>
                </div>);
    }
}

SearchPage.propTypes = {
    query:                PropTypes.string,
    appliedFilters:       PropTypes.array,
    settings:             PropTypes.object,
    close:                PropTypes.func,
    onResultClick:        PropTypes.func,
    onQueryChange:        PropTypes.func,
    updateAppliedFilter:  PropTypes.func,
    updateAppliedOptionField: PropTypes.func,
    updateAppliedOptionSort:  PropTypes.func,
    registerAvailableFilters: PropTypes.func,
    availableFilters:     PropTypes.array,
    filtersValid:         PropTypes.bool,
    hideNavHeader:        PropTypes.bool,
    exactField:           PropTypes.string,
    broadField:           PropTypes.string,
    field:                PropTypes.string,
    sortType:             PropTypes.oneOf(["relevance","chronological"])
};

SearchPage.defaultProps = {
  appliedFilters: []
};


class SearchBar extends Component {
    constructor(props) {
      super(props);

      this.state = {query: props.initialQuery};
    }
    handleKeypress(event) {
        if (event.charCode == 13) {
            this.updateQuery();
            // Blur search input to close keyboard
            $(ReactDOM.findDOMNode(this)).find(".readerSearch").blur();
        }
    }
    updateQuery() {
        if (this.props.updateQuery) {
            this.props.updateQuery(this.state.query)
        }
    }
    handleChange(event) {
        this.setState({query: event.target.value});
    }
    render () {
        return (
            <div>
                <div className="searchBox">
                    <input className="readerSearch" id="searchInput" title="Search for Texts or Keywords Here" value={this.state.query} onKeyPress={this.handleKeypress} onChange={this.handleChange} placeholder="Search"/>
                    <ReaderNavigationMenuSearchButton onClick={this.updateQuery} />
                </div>
                <div className="description"></div>
            </div>
        )
    }
}

SearchBar.propTypes = {
    initialQuery: PropTypes.string,
    updateQuery: PropTypes.func
};


class SearchResultList extends Component {
    constructor(props) {
        super(props);

        this.initialQuerySize = 100,
        this.backgroundQuerySize = 1000,
        this.maxResultSize = 10000,
        this.resultDisplayStep = 50,
        this.state = {
            types: ["text", "sheet"],
            runningQueries: {"text": null, "sheet": null},
            isQueryRunning: {"text": false, "sheet": false},
            moreToLoad: {"text": true, "sheet": true},
            totals: {"text":0, "sheet":0},
            displayedUntil: {"text":50, "sheet":50},
            hits: {"text": [], "sheet": []},
            activeTab: "text",
            error: false,
            showOverlay: false,
            displayFilters: false,
            displaySort: false
        }
    }
    updateRunningQuery(type, ajax, isLoadingRemainder) {
        this.state.runningQueries[type] = ajax;
        this.state.isQueryRunning[type] = !!ajax && !isLoadingRemainder;
        this.setState({
          runningQueries: this.state.runningQueries,
          isQueryRunning: this.state.isQueryRunning
        });
    }
    _abortRunningQueries() {
        this.state.types.forEach(t => this._abortRunningQuery(t));
    }
    _abortRunningQuery(type) {
        if(this.state.runningQueries[type]) {
            this.state.runningQueries[type].abort();
        }
        this.updateRunningQuery(type, null, false);
    }
    componentDidMount() {
        this._executeQueries();
        $(ReactDOM.findDOMNode(this)).closest(".content").bind("scroll", this.handleScroll);
    }
    componentWillUnmount() {
        this._abortRunningQueries();
        $(ReactDOM.findDOMNode(this)).closest(".content").unbind("scroll", this.handleScroll);
    }
    handleScroll() {
      var tab = this.state.activeTab;
      if (this.state.displayedUntil[tab] >= this.state.totals[tab]) { return; }
      var $scrollable = $(ReactDOM.findDOMNode(this)).closest(".content");
      var margin = 100;
      if($scrollable.scrollTop() + $scrollable.innerHeight() + margin >= $scrollable[0].scrollHeight) {
        this._extendResultsDisplayed();
      }
    }
    _extendResultsDisplayed() {
      var tab = this.state.activeTab;
      this.state.displayedUntil[tab] += this.resultDisplayStep;
      if (this.state.displayedUntil[tab] >= this.state.totals[tab]) {
        this.state.displayedUntil[tab] = this.state.totals[tab];
      }
      this.setState({displayedUntil: this.state.displayedUntil});
    }
    componentWillReceiveProps(newProps) {
        if(this.props.query != newProps.query) {
           this.setState({
             totals: {"text":0, "sheet":0},
             hits: {"text": [], "sheet": []},
             moreToLoad: {"text": true, "sheet": true},
             displayedUntil: {"text":50, "sheet":50},
             displayFilters: false,
             displaySort: false,
             showOverlay: false
           });
           this._executeQueries(newProps)
        }
        else if (
        (this.props.appliedFilters.length !== newProps.appliedFilters.length) ||
          !(this.props.appliedFilters.every((v,i) => v === newProps.appliedFilters[i]))) {
           this._executeQueries(newProps)
        }
        // Execute a second query to apply filters after an initial query which got available filters
        else if ((this.props.filtersValid != newProps.filtersValid) && this.props.appliedFilters.length > 0) {
           this._executeQueries(newProps);
        }
        else if (this.props.field != newProps.field || this.props.sortType != newProps.sortType) {
          this._executeQueries(newProps);
        }
    }
    _loadRemainder(type, last, total, currentHits) {
    // Having loaded "last" results, and with "total" results to load, load the rest, this.backgroundQuerySize at a time
      if (last >= total || last >= this.maxResultSize) {
        this.updateRunningQuery(type, null, false);
        this.state.moreToLoad[type] = false;
        this.setState({moreToLoad: this.state.moreToLoad});
        return;
      }

      var querySize = this.backgroundQuerySize;
      if (last + querySize > this.maxResultSize) {
        querySize = this.maxResultSize - last;
      }

      var field = "content";
      if (type == "text") {
        field = this.props.field;
      }
      var query_props = {
        query: this.props.query,
        type: type,
        size: querySize,
        from: last,
        field: field,
        sort_type: this.props.sortType,
        exact: this.props.exactField === this.props.field,
        error: function() {  console.log("Failure in SearchResultList._loadRemainder"); },
        success: function(data) {
          var nextHits = currentHits.concat(data.hits.hits);
          if (type === "text") {
            nextHits = this._process_text_hits(nextHits);
          }

          this.state.hits[type] = nextHits;

          this.setState({hits: this.state.hits});
          this._loadRemainder(type, last + this.backgroundQuerySize, total, nextHits);
        }.bind(this)
      };
      if (type == "text") {
        extend(query_props, {
          get_filters: false,
          applied_filters: this.props.appliedFilters
        });
      }

      var runningLoadRemainderQuery = Sefaria.search.execute_query(query_props);
      this.updateRunningQuery(type, runningLoadRemainderQuery, true);
    }
    _executeQueries(props) {
        //This takes a props object, so as to be able to handle being called from componentWillReceiveProps with newProps
        props = props || this.props;
        if (!props.query) {
            return;
        }

        this._abortRunningQueries();

        // If there are no available filters yet, don't apply filters.  Split into two queries:
        // 1) Get all potential filters and counts
        // 2) Apply filters (Triggered from componentWillReceiveProps)
        var request_applied = props.filtersValid && props.appliedFilters;
        var isCompletionStep = !!request_applied || props.appliedFilters.length == 0;

        var runningSheetQuery = Sefaria.search.execute_query({
            query: props.query,
            type: "sheet",
            size: this.initialQuerySize,
            field: "content",
            sort_type: "chronological",
            exact: true,
            success: function(data) {
                this.updateRunningQuery("sheet", null, false);
                  this.setState({
                    hits: extend(this.state.hits, {"sheet": data.hits.hits}),
                    totals: extend(this.state.totals, {"sheet": data.hits.total})
                  });
                  Sefaria.site.track.event("Search", "Query: sheet", props.query, data.hits.total);

                if(isCompletionStep) {
                  this._loadRemainder("sheet", this.initialQuerySize, data.hits.total, data.hits.hits);
                }

            }.bind(this),
            error: this._handle_error
        });

        var runningTextQuery = Sefaria.search.execute_query({
            query: props.query,
            type: "text",
            get_filters: !props.filtersValid,
            applied_filters: request_applied,
            size: this.initialQuerySize,
            field: props.field,
            sort_type: props.sortType,
            exact: props.exactField === props.field,
            success: function(data) {
                this.updateRunningQuery("text", null, false);
                var hitArray = this._process_text_hits(data.hits.hits);
                this.setState({
                  hits: extend(this.state.hits, {"text": hitArray}),
                  totals: extend(this.state.totals, {"text": data.hits.total})
                });
                var filter_label = (request_applied && request_applied.length > 0)? (" - " + request_applied.join("|")) : "";
                var query_label = props.query + filter_label;
                Sefaria.site.track.event("Search", "Query: text", query_label, data.hits.total);
                if (data.aggregations) {
                  if (data.aggregations.category) {
                    var ftree = this._buildFilterTree(data.aggregations.category.buckets);
                    var orphans = this._applyFilters(ftree, this.props.appliedFilters);
                    this.props.registerAvailableFilters(ftree.availableFilters, ftree.registry, orphans);
                  }
                }
                if(isCompletionStep) {
                  this._loadRemainder("text", this.initialQuerySize, data.hits.total, hitArray);
                }
            }.bind(this),
            error: this._handle_error
        });

        this.updateRunningQuery("text", runningTextQuery, false);
        this.updateRunningQuery("sheet", runningSheetQuery, false);
    }
    _handle_error(jqXHR, textStatus, errorThrown) {
        if (textStatus == "abort") {
            // Abort is immediately followed by new query, above.  Worried there would be a race if we call updateCurrentQuery(null) from here
            //this.updateCurrentQuery(null);
            return;
        }
        this.setState({error: true});
        this.updateRunningQuery(null, null, false);
    }
    _process_text_hits(hits) {
      var newHits = [];
      var newHitsObj = {};  // map ref -> index in newHits
      for (var i = 0; i < hits.length; i++) {
        let currRef = hits[i]._source.ref;
        let newHitsIndex = newHitsObj[currRef];
        if (typeof newHitsIndex != "undefined") {
          newHits[newHitsIndex].duplicates = newHits[newHitsIndex].duplicates || [];
          newHits[newHitsIndex].duplicates.push(hits[i]);
        } else {
          newHits.push(hits[i])
          newHitsObj[currRef] = newHits.length - 1;
        }
      }
      return newHits;
    }
    _buildFilterTree(aggregation_buckets) {
      //returns object w/ keys 'availableFilters', 'registry'
      //Add already applied filters w/ empty doc count?
      var rawTree = {};

      this.props.appliedFilters.forEach(
          fkey => this._addAvailableFilter(rawTree, fkey, {"docCount":0})
      );

      aggregation_buckets.forEach(
          f => this._addAvailableFilter(rawTree, f["key"], {"docCount":f["doc_count"]})
      );
      this._aggregate(rawTree);
      return this._build(rawTree);
    }
    _addAvailableFilter(rawTree, key, data) {
      //key is a '/' separated key list, data is an arbitrary object
      //Based on http://stackoverflow.com/a/11433067/213042
      var keys = key.split("/");
      var base = rawTree;

      // If a value is given, remove the last name and keep it for later:
      var lastName = arguments.length === 3 ? keys.pop() : false;

      // Walk the hierarchy, creating new objects where needed.
      // If the lastName was removed, then the last object is not set yet:
      var i;
      for(i = 0; i < keys.length; i++ ) {
          base = base[ keys[i] ] = base[ keys[i] ] || {};
      }

      // If a value was given, set it to the last name:
      if( lastName ) {
          base = base[ lastName ] = data;
      }

      // Could return the last object in the hierarchy.
      // return base;
    }
    _aggregate(rawTree) {
      //Iterates the raw tree to aggregate doc_counts from the bottom up
      //Nod to http://stackoverflow.com/a/17546800/213042
      walker("", rawTree);
      function walker(key, branch) {
          if (branch !== null && typeof branch === "object") {
              // Recurse into children
              $.each(branch, walker);
              // Do the summation with a hacked object 'reduce'
              if ((!("docCount" in branch)) || (branch["docCount"] === 0)) {
                  branch["docCount"] = Object.keys(branch).reduce(function (previous, key) {
                      if (typeof branch[key] === "object" && "docCount" in branch[key]) {
                          previous += branch[key].docCount;
                      }
                      return previous;
                  }, 0);
              }
          }
      }
    }
    _build(rawTree) {
      //returns dict w/ keys 'availableFilters', 'registry'
      //Aggregate counts, then sort rawTree into filter objects and add Hebrew using Sefaria.toc as reference
      //Nod to http://stackoverflow.com/a/17546800/213042
      var path = [];
      var filters = [];
      var registry = {};

      var commentaryNode = new Sefaria.search.FilterNode();


      for(var j = 0; j < Sefaria.search_toc.length; j++) {
          var b = walk.call(this, Sefaria.search_toc[j]);
          if (b) filters.push(b);

          // Remove after commentary refactor ?
          // If there is commentary on this node, add it as a sibling
          if (commentaryNode.hasChildren()) {
            var toc_branch = Sefaria.toc[j];
            var cat = toc_branch["category"];
            // Append commentary node to result filters, add a fresh one for the next round
            var docCount = 0;
            if (rawTree.Commentary && rawTree.Commentary[cat]) { docCount += rawTree.Commentary[cat].docCount; }
            if (rawTree.Commentary2 && rawTree.Commentary2[cat]) { docCount += rawTree.Commentary2[cat].docCount; }
            extend(commentaryNode, {
                "title": cat + " Commentary",
                "path": "Commentary/" + cat,
                "heTitle": "מפרשי" + " " + toc_branch["heCategory"],
                "docCount": docCount
            });
            registry[commentaryNode.path] = commentaryNode;
            filters.push(commentaryNode);
            commentaryNode = new Sefaria.search.FilterNode();
          }
      }

      return {availableFilters: filters, registry: registry};

      function walk(branch, parentNode) {
          var node = new Sefaria.search.FilterNode();

          node["docCount"] = 0;

          if("category" in branch) { // Category node

            path.push(branch["category"]);  // Place this category at the *end* of the path
            extend(node, {
              "title": path.slice(-1)[0],
              "path": path.join("/"),
              "heTitle": branch["heCategory"]
            });

            for(var j = 0; j < branch["contents"].length; j++) {
                var b = walk.call(this, branch["contents"][j], node);
                if (b) node.append(b);
            }
          }
          else if ("title" in branch) { // Text Node
              path.push(branch["title"]);
              extend(node, {
                 "title": path.slice(-1)[0],
                 "path": path.join("/"),
                 "heTitle": branch["heTitle"]
              });
          }

          try {
              var rawNode = rawTree;
              var i;

              for (i = 0; i < path.length; i++) {
                //For TOC nodes that we don't have results for, we catch the exception below.
                rawNode = rawNode[path[i]];
              }
              node["docCount"] += rawNode.docCount;


              // Do we need both of these in the registry?
              registry[node.getId()] = node;
              registry[node.path] = node;

              path.pop();
              return node;
          }
          catch (e) {
            path.pop();
            return false;
          }
      }
    }
    _applyFilters(ftree, appliedFilters) {
      var orphans = [];  // todo: confirm behavior
      appliedFilters.forEach(path => {
        var node = ftree.registry[path];
        if (node) { node.setSelected(true); }
        else { orphans.push(path); }
      });
      return orphans;
    }
    showSheets() {
      this.setState({"activeTab": "sheet"});
    }
    showTexts() {
      this.setState({"activeTab": "text"});
    }
    showResultsOverlay(shouldShow) {
      //overlay gives opacity to results when either filter box or sort box is open
      this.setState({showOverlay: shouldShow});
    }
    toggleFilterView() {
      this.showResultsOverlay(!this.state.displayFilters);
      this.setState({displayFilters: !this.state.displayFilters, displaySort: false});
    }
    toggleSortView() {
      this.showResultsOverlay(!this.state.displaySort);
      this.setState({displaySort: !this.state.displaySort, displayFilters: false});
    }
    closeFilterView() {
      this.showResultsOverlay(false);
      this.setState({displayFilters: false});
    }
    closeSortView() {
      this.showResultsOverlay(false);
      this.setState({displaySort: false});
    }
    render () {
        if (!(this.props.query)) {  // Push this up? Thought is to choose on the SearchPage level whether to show a ResultList or an EmptySearchMessage.
            return null;
        }

        var tab = this.state.activeTab;
        var results = [];

        if (tab == "text") {
          results = this.state.hits.text.slice(0,this.state.displayedUntil["text"]).filter(result => !!result._source.version).map(result =>
            <SearchTextResult
                data={result}
                query={this.props.query}
                key={result._id}
                onResultClick={this.props.onResultClick} />);

        } else if (tab == "sheet") {
          results = this.state.hits.sheet.slice(0, this.state.displayedUntil["sheet"]).map(result =>
              <SearchSheetResult
                    data={result}
                    query={this.props.query}
                    key={result._id} />);
        }

        var loadingMessage   = (<LoadingMessage message="Searching..." heMessage="מבצע חיפוש..." />);
        var noResultsMessage = (<LoadingMessage message="0 results." heMessage="0 תוצאות." />);

        var queryFullyLoaded      = !this.state.moreToLoad[tab] && !this.state.isQueryRunning[tab];
        var haveResults      = !!results.length;
        results              = haveResults ? results : noResultsMessage;
        var searchFilters    = (<SearchFilters
                                  query = {this.props.query}
                                  total = {this.state.totals["text"] + this.state.totals["sheet"]}
                                  textTotal = {this.state.totals["text"]}
                                  sheetTotal = {this.state.totals["sheet"]}
                                  availableFilters={this.props.availableFilters}
                                  appliedFilters = {this.props.appliedFilters}
                                  updateAppliedFilter = {this.props.updateAppliedFilter}
                                  updateAppliedOptionField = {this.props.updateAppliedOptionField}
                                  updateAppliedOptionSort = {this.props.updateAppliedOptionSort}
                                  exactField = {this.props.exactField}
                                  broadField = {this.props.broadField}
                                  optionField = {this.props.field}
                                  sortType = {this.props.sortType}
                                  isQueryRunning = {this.state.isQueryRunning[tab]}
                                  activeTab = {this.state.activeTab}
                                  clickTextButton = {this.showTexts}
                                  clickSheetButton = {this.showSheets}
                                  showResultsOverlay = {this.showResultsOverlay}
                                  displayFilters={this.state.displayFilters}
                                  displaySort={this.state.displaySort}
                                  toggleFilterView={this.toggleFilterView}
                                  toggleSortView={this.toggleSortView}
                                  closeFilterView={this.closeFilterView}
                                  closeSortView={this.closeSortView}/>);
        return (
          <div>
            { searchFilters }
            <div className={this.state.showOverlay ? "searchResultsOverlay" : ""}>
              { queryFullyLoaded || haveResults ? results : loadingMessage }
            </div>
          </div>
        );
    }
}

SearchResultList.propTypes = {
  query:                PropTypes.string,
  appliedFilters:       PropTypes.array,
  onResultClick:        PropTypes.func,
  filtersValid:         PropTypes.bool,
  availableFilters:     PropTypes.array,
  updateAppliedFilter:  PropTypes.func,
  updateAppliedOptionField: PropTypes.func,
  updateAppliedOptionSort:  PropTypes.func,
  exactField:           PropTypes.string,
  broadField:           PropTypes.string,
  field:                PropTypes.string,
  sortType:            PropTypes.oneOf(["relevance", "chronological"]),
  registerAvailableFilters: PropTypes.func
};

SearchResultList.defaultProps = {
  appliedFilters: []
};


class SearchFilters extends Component {
  constructor(props) {
    super(props);

    this.state = {
      openedCategory: null,
      openedCategoryBooks: [],
      isExactSearch: props.optionField === props.exactField
    }
  }

  componentWillReceiveProps(newProps) {
    // Save current filters
    // this.props
    // todo: check for cases when we want to rebuild / not

    if ((newProps.query != this.props.query)
        || (newProps.availableFilters.length == 0)) {

      this.setState({
        openedCategory: null,
        openedCategoryBooks: [],
        isExactSearch: this.props.optionField === this.props.exactField
      });
    }
    // todo: logically, we should be unapplying filters as well.
    // Because we compute filter removal from teh same object, this ends up sliding in messily in the setState.
    // Hard to see how to get it through the front door.
      //if (this.state.openedCategory) {
      //   debugger;
      // }
     /*
   if (newProps.appliedFilters &&
              ((newProps.appliedFilters.length !== this.props.appliedFilters.length)
               || !(newProps.appliedFilters.every((v,i) => v === this.props.appliedFilters[i]))
              )
            ) {
      if (this.state.openedCategory) {
        this.handleFocusCategory(this.state.openedCategory);
      }
    } */
  }
  getSelectedTitles(lang) {
    var results = [];
    for (var i = 0; i < this.props.availableFilters.length; i++) {
        results = results.concat(this.props.availableFilters[i].getSelectedTitles(lang));
    }
    return results;
  }
  handleFocusCategory(filterNode) {
    var leaves = filterNode.getLeafNodes();
    this.setState({
      openedCategory: filterNode,
      openedCategoryBooks: leaves
    })
  }
  toggleExactSearch() {
    let newExactSearch = !this.state.isExactSearch;
    if (newExactSearch) {
      this.props.updateAppliedOptionField(this.props.exactField);
    } else {
      this.props.updateAppliedOptionField(this.props.broadField);
    }
    this.setState({isExactSearch: newExactSearch});

  }
  _type_button(en_singular, en_plural, he_singular, he_plural, total, on_click, active) {
    // if (!total) { return "" }
      var total_with_commas = this._add_commas(total);
      var classes = classNames({"type-button": 1, active: active});

      return <div className={classes} onClick={on_click}>
      <div className="type-button-total">
        {total_with_commas}
      </div>
      <div className="type-button-title">
        <span className="int-en">{(total != 1) ? en_plural : en_singular}</span>
        <span className="int-he">{(total != 1) ? he_plural : he_singular}</span>
      </div>
    </div>;
  }
  _add_commas(number) {
    return number.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  }
  render() {

    var runningQueryLine = (<LoadingMessage message="Searching..." heMessage="מבצע חיפוש..." />);

    var buttons = (
      <div className="type-buttons">
        {this._type_button("Text", "Texts", "מקור", "מקורות", this.props.textTotal, this.props.clickTextButton, (this.props.activeTab == "text"))}
        {this._type_button("Sheet", "Sheets", "דף מקורות", "דפי מקורות", this.props.sheetTotal, this.props.clickSheetButton, (this.props.activeTab == "sheet"))}
      </div>
    );

    var selected_filters = (<div className="results-count">
          <span className="int-en">
            {(!!this.props.appliedFilters.length && !!this.props.total)?(this.getSelectedTitles("en").join(", ")):""}
          </span>
          <span className="int-he">
            {(!!this.props.appliedFilters.length && !!this.props.total)?(this.getSelectedTitles("he").join(", ")):""}
          </span>
      </div>);
    var filter_panel = (<SearchFilterPanel
        toggleFilterView={this.props.toggleFilterView}
        toggleExactSearch={this.toggleExactSearch}
        displayFilters={this.props.displayFilters}
        availableFilters={this.props.availableFilters}
        openedCategory={this.state.openedCategory}
        openedCategoryBooks={this.state.openedCategoryBooks}
        updateAppliedFilter={this.props.updateAppliedFilter}
        query={this.props.query}
        closeBox={this.props.closeFilterView}
        isExactSearch={this.props.exactField === this.props.optionField}
        handleFocusCategory={this.handleFocusCategory}
    />);

    var sort_panel = (<SearchSortBox
          visible={this.props.displaySort}
          toggleSortView={this.props.toggleSortView}
          updateAppliedOptionSort={this.props.updateAppliedOptionSort}
          closeBox={this.props.closeSortView}
          sortType={this.props.sortType}/>);
    return (
      <div className={ classNames({searchTopMatter: 1, loading: this.props.isQueryRunning}) }>
        <div className="searchStatusLine">
          { (this.props.isQueryRunning) ? runningQueryLine : buttons }
          { (this.props.availableFilters.length > 0 && this.props.activeTab == "text") ? selected_filters : ""}
        </div>
        { ((true || this.props.availableFilters.length > 0) && this.props.activeTab == "text") ?
            (<div className="filterSortFlexbox">
              {filter_panel}
              {sort_panel}
            </div>)
            : "" }
      </div>);
  }
}

SearchFilters.propTypes = {
  query:                PropTypes.string,
  total:                PropTypes.number,
  textTotal:            PropTypes.number,
  sheetTotal:           PropTypes.number,
  appliedFilters:       PropTypes.array,
  availableFilters:     PropTypes.array,
  updateAppliedFilter:  PropTypes.func,
  updateAppliedOptionField: PropTypes.func,
  updateAppliedOptionSort: PropTypes.func,
  exactField:           PropTypes.string,
  broadField:           PropTypes.string,
  optionField:          PropTypes.string,
  sortType:             PropTypes.string,
  isQueryRunning:       PropTypes.bool,
  activeTab:            PropTypes.string,
  clickTextButton:      PropTypes.func,
  clickSheetButton:     PropTypes.func,
  showResultsOverlay:   PropTypes.func,
  displayFilters:       PropTypes.bool,
  displaySort:          PropTypes.bool,
  toggleFilterView:     PropTypes.func,
  toggleSortView:       PropTypes.func,
  closeFilterView:      PropTypes.func,
  closeSortView:        PropTypes.func
};

SearchFilters.defaultProps = {
  appliedFilters: [],
  availableFilters: []
};


class SearchFilterPanel extends Component {
  componentDidMount() {
    document.addEventListener('mousedown', this.handleClickOutside, false);
  }
  componentWillUnmount() {
    document.removeEventListener('mousedown', this.handleClickOutside, false);
  }
  handleClickOutside(event) {
    const domNode = ReactDOM.findDOMNode(this);
    if ((!domNode || !domNode.contains(event.target)) && this.props.displayFilters) {
      this.props.closeBox();
    }
  }
  render() {
    return (<div>
      <div className="searchFilterToggle" onClick={this.props.toggleFilterView}>
        <span className="int-en">Filter</span>
        <span className="int-he">סינון</span>
        {(this.props.displayFilters) ? <img src="/static/img/arrow-up.png" alt=""/> : <img src="/static/img/arrow-down.png" alt=""/>}
      </div>
      <div className={(this.props.displayFilters) ? "searchFilterBoxes":"searchFilterBoxes hidden"}>
        <div className="searchFilterBoxRow">
          <div className="searchFilterCategoryBox">
          {this.props.availableFilters.map(function(filter) {
              return (<SearchFilter
                  filter={filter}
                  isInFocus={this.props.openedCategory === filter}
                  focusCategory={this.props.handleFocusCategory}
                  updateSelected={this.props.updateAppliedFilter}
                  key={filter.path}/>);
          }.bind(this))}
          </div>
          <div className="searchFilterBookBox">
          {this.props.openedCategoryBooks.map(function(filter) {
              return (<SearchFilter
                  filter={filter}
                  updateSelected={this.props.updateAppliedFilter}
                  key={filter.path}/>);
          }.bind(this))}
          </div>
        </div>
        <div className={"searchFilterExactBox"}>
          <SearchFilterExactBox
            selected={this.props.isExactSearch}
            checkBoxClick={this.props.toggleExactSearch}
            />
        </div>
        <div style={{clear: "both"}}/>
      </div>
    </div>);
  }
}

SearchFilterPanel.propTypes = {
  toggleFilterView:    PropTypes.func,
  displayFilters:      PropTypes.bool,
  availableFilters:    PropTypes.array,
  openedCategory:      PropTypes.object,
  updateAppliedFilter: PropTypes.func,
  openedCategoryBooks: PropTypes.array,
  query:               PropTypes.string,
  isExactSearch:       PropTypes.bool,
  toggleExactSearch:   PropTypes.func,
  closeBox:            PropTypes.func,
  handleFocusCategory: PropTypes.func
};


class SearchSortBox extends Component {
  componentDidMount() {
    document.addEventListener('mousedown', this.handleClickOutside, false);
  }
  componentWillUnmount() {
    document.removeEventListener('mousedown', this.handleClickOutside, false);
  }
  handleClickOutside(event) {
    const domNode = ReactDOM.findDOMNode(this);

    if ((!domNode || !domNode.contains(event.target)) && this.props.visible) {
      this.props.closeBox();
    }
  }
  handleClick(sortType) {
    if (sortType === this.props.sortType) {
      return;
    }
    if (this.props.sortType === "chronological") {
      this.props.updateAppliedOptionSort("relevance");
    } else {
      this.props.updateAppliedOptionSort("chronological");
    }
    this.props.toggleSortView();
  }
  //<i className={(this.props.visible) ? "fa fa-caret-down fa-angle-down":"fa fa-caret-down fa-angle-up"} />
  render() {
    var chronoClass = classNames({'filter-title': 1, 'unselected': this.props.sortType !== "chronological"});
    var releClass = classNames({'filter-title': 1, 'unselected': this.props.sortType !== "relevance"});
    return (<div>
      <div className="searchFilterToggle" onClick={this.props.toggleSortView}>
        <span className="int-en">Sort</span>
        <span className="int-he">מיון</span>
        {(this.props.visible) ? <img src="/static/img/arrow-up.png" alt=""/> : <img src="/static/img/arrow-down.png" alt=""/>}

      </div>
      <div className={(this.props.visible) ? "searchSortBox" :"searchSortBox hidden"}>
        <table>
          <tbody>
            <tr  className={releClass} onClick={()=>this.handleClick("relevance")}>
              <td>
                <img className="searchSortCheck" src="/static/img/check-mark.svg" alt="relevance sort selected"/>
              </td>
              <td>
                <span className="int-en">{"Relevance"}</span>
                <span className="int-he" dir="rtl">{"רלוונטיות"}</span>
              </td>
            </tr>
            <tr className={chronoClass} onClick={()=>this.handleClick("chronological")}>
              <td>
                <img className="searchSortCheck" src="/static/img/check-mark.svg" alt="chronological sort selected"/>
              </td>
              <td>
                <span className="int-en">{"Chronological"}</span>
                <span className="int-he" dir="rtl">{"כרונולוגי"}</span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>);
  }
}

SearchSortBox.propTypes = {
  visible:                 PropTypes.bool,
  toggleSortView:          PropTypes.func,
  updateAppliedOptionSort: PropTypes.func,
  closeBox:                PropTypes.func,
  sortType:                PropTypes.oneOf(["chronological", "relevance"])
};


class SearchFilterExactBox extends Component {
  handleClick() {
    this.props.checkBoxClick();
  }
  render() {
    return (<li>
      <input type="checkbox" id="searchFilterExactBox" className="filter" checked={this.props.selected} onChange={this.handleClick}/>
      <label onClick={this.handleClick}><span></span></label>
      <span className="int-en"><span className="filter-title">{"Exact search"}</span></span>
      <span className="int-he" dir="rtl"><span className="filter-title">{"חיפוש מדויק"}</span></span>
    </li>);
  }
}

SearchFilterExactBox.propTypes = {
  selected:      PropTypes.bool,
  checkBoxClick: PropTypes.func
};


class SearchFilter extends Component {
  constructor(props) {
    super(props);

    this.state = {selected: props.filter.selected};
  }
  componentWillReceiveProps(newProps) {
    if (newProps.filter.selected != this.state.selected) {
      this.setState({selected: newProps.filter.selected});
    }
  }
  // Can't set indeterminate in the render phase.  https://github.com/facebook/react/issues/1798
  componentDidMount() {
    ReactDOM.findDOMNode(this).querySelector("input").indeterminate = this.props.filter.isPartial();
  }
  componentDidUpdate() {
    ReactDOM.findDOMNode(this).querySelector("input").indeterminate = this.props.filter.isPartial();
  }
  handleFilterClick(evt) {
    //evt.preventDefault();
    this.props.updateSelected(this.props.filter)
  }
  handleFocusCategory() {
    if (this.props.focusCategory) {
      this.props.focusCategory(this.props.filter)
    }
  }
  render() {
    return(
      <li onClick={this.handleFocusCategory}>
        <input type="checkbox" id={this.props.filter.path} className="filter" checked={this.state.selected == 1} onChange={this.handleFilterClick}/>
        <label onClick={this.handleFilterClick}><span></span></label>
        <span className="int-en"><span className="filter-title">{this.props.filter.title}</span> <span className="filter-count">({this.props.filter.docCount})</span></span>
        <span className="int-he" dir="rtl"><span className="filter-title">{this.props.filter.heTitle}</span> <span className="filter-count">({this.props.filter.docCount})</span></span>
        {this.props.isInFocus?<span className="int-en"><i className="in-focus-arrow fa fa-caret-right"/></span>:""}
        {this.props.isInFocus?<span className="int-he"><i className="in-focus-arrow fa fa-caret-left"/></span>:""}
      </li>);
  }
}

SearchFilter.propTypes = {
  filter:         PropTypes.object.isRequired,
  isInFocus:      PropTypes.bool,
  updateSelected: PropTypes.func.isRequired,
  focusCategory:  PropTypes.func
};


class SearchTextResult extends Component {
    constructor(props) {
        super(props);

        this.state = {
            duplicatesShown: false
        };
    }
    toggleDuplicates(event) {
        this.setState({
            duplicatesShown: !this.state.duplicatesShown
        });
    }
    handleResultClick(event) {
        if(this.props.onResultClick) {
            event.preventDefault();
            var s = this.props.data._source;
            Sefaria.site.track.event("Search", "Search Result Text Click", `${this.props.query} - ${s.ref}/${s.version}/${s.lang}`);
            this.props.onResultClick(s.ref, s.version, s.lang, {"highlight": this.props.query}); //highlight not yet handled, above in ReaderApp.handleNavigationClick()
        }
    }
    render () {
        var data = this.props.data;
        var s = this.props.data._source;
        var href = '/' + Sefaria.normRef(s.ref) + "/" + s.lang + "/" + s.version.replace(/ +/g, "_") + '?qh=' + this.props.query;

        function get_snippet_markup() {
            var snippet;
            var field = Object.keys(data.highlight)[0]; //there should only be one key
            // if (data.highlight && data.highlight[field]) {
            snippet = data.highlight[field].join("...");
            // } else {
            //     snippet = s[field];  // We're filtering out content, because it's *huge*, especially on Sheets
            // }
            let dir = Sefaria.hebrew.isHebrew(snippet) ? "rtl" : "ltr";
            snippet = $("<div>" + snippet.replace(/^[ .,;:!-)\]]+/, "") + "</div>").html();
            return {markup:{__html:snippet}, dir: dir};
        }

        var more_results_caret =
            (this.state.duplicatesShown)
            ? <i className="fa fa-caret-down fa-angle-down"></i>
            : <i className="fa fa-caret-down"></i>;

        var more_results_indicator = (!(data.duplicates)) ? "" :
                <div className='similar-trigger-box' onClick={this.toggleDuplicates}>
                    <span className='similar-title int-he'>
                        { data.duplicates.length } {(data.duplicates.length > 1) ? " גרסאות נוספות" : " גרסה נוספת"}
                    </span>
                    <span className='similar-title int-en'>
                        { data.duplicates.length } more version{(data.duplicates.length > 1) ? "s" : null}
                    </span>
                    {more_results_caret}
                </div>;

        var shown_duplicates = (data.duplicates && this.state.duplicatesShown) ?
            (<div className='similar-results'>
                    {data.duplicates.filter(result => !!result._source.version).map(function(result) {
                        var key = result._source.ref + "-" + result._source.version;
                        return <SearchTextResult
                            data={result}
                            key={key}
                            query={this.props.query}
                            onResultClick={this.props.onResultClick}
                            />;
                        }.bind(this))}
            </div>) : null;

        var snippetMarkup = get_snippet_markup();

        return (
            <div className="result text_result">
                <a href={href} onClick={this.handleResultClick}>
                    <div className="result-title">
                        <span className="en">{s.ref}</span>
                        <span className="he">{s.heRef}</span>
                    </div>
                    <div className="snippet" dir={snippetMarkup.dir} dangerouslySetInnerHTML={snippetMarkup.markup} ></div>
                    <div className="version" >{s.version}</div>
                </a>
                {more_results_indicator}
                {shown_duplicates}
            </div>
        )
    }
}

SearchTextResult.propTypes = {
    query: PropTypes.string,
    data: PropTypes.object,
    onResultClick: PropTypes.func
};


class SearchSheetResult extends Component {
    handleSheetClick(e) {
      var href = e.target.getAttribute("href");
      e.preventDefault();
      var s = this.props.data._source;
      Sefaria.site.track.event("Search", "Search Result Sheet Click", `${this.props.query} - ${s.sheetId}`,
          {hitCallback: () => window.location = href}
      );
    }
    handleProfileClick(e) {
      var href = e.target.getAttribute("href");
      e.preventDefault();
      var s = this.props.data._source;
      Sefaria.site.track.event("Search", "Search Result Sheet Owner Click", `${this.props.query} - ${s.sheetId} - ${s.owner_name}`,
          {hitCallback: () => window.location = href}
      );
    }
    render() {
        var data = this.props.data;
        var s = data._source;

        var snippet = data.highlight.content.join("..."); // data.highlight ? data.highlight.content.join("...") : s.content;
        snippet = $("<div>" + snippet.replace(/^[ .,;:!-)\]]+/, "") + "</div>").text();

        function get_version_markup() {
            return {__html: s.version};
        }
        var clean_title = $("<span>" + s.title + "</span>").text();
        var href = "/sheets/" + s.sheetId;
        return (
            <div className='result sheet_result'>
              <div className="result_img_box"><a href={s.profile_url} onClick={this.handleProfileClick}><img className='owner_image' src={s.owner_image} alt={s.owner_name} /></a></div>
              <div className="result_text_box">
                <a href={s.profile_url} onClick={this.handleProfileClick} className='owner_name'>{s.owner_name}</a>
                <a className='result-title' href={href} onClick={this.handleSheetClick}>{clean_title}</a>
                <div className="snippet">{snippet}</div>
              </div>
            </div>
        );
    }
}

SearchSheetResult.propTypes = {
  query: PropTypes.string,
  data: PropTypes.object
};

module.exports = SearchPage;
